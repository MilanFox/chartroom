import { describe, expect, it } from 'vitest';
import { apiClient, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';

const ADMIN_FIELDS = ['createdAt', 'revokedAt', 'lastUsedAt', 'updatedAt', 'updatedBy', 'secretHistory'];

describe('holder administration', () => {
  const server = useTestServer();

  const elevatedViewer = async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    return ui;
  };

  it('an elevated session creates a holder and receives the secret exactly once', async () => {
    const admin = await elevatedViewer();

    const created = await admin.createHolder('grace', 'Grace Hopper');

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: 'grace', displayName: 'Grace Hopper', revoked: false, revokedAt: null, lastUsedAt: null, updatedBy: 'admin' });
    expect(created.body.secret).toMatch(/^chr_grace_[0-9A-Za-z]{40,44}$/);
    expect(created.body.secretHistory).toEqual([{ hash: expect.stringMatching(/^[0-9a-f]{64}$/), createdAt: expect.any(String), revokedAt: null }]);
    expect(created.body.secretHistory[0].hash).not.toContain(created.body.secret);

    const roster = await admin.json('GET', '/holders');
    expect(JSON.stringify(roster.body)).not.toContain(created.body.secret);
    expect(roster.body.find((holder: { slug: string }) => holder.slug === 'grace').secret).toBeUndefined();
  });

  it('refuses the reserved slug, a bad shape and a duplicate', async () => {
    const admin = await elevatedViewer();
    await admin.createHolder('taken');

    const reserved = await admin.createHolder('admin');
    const shape = await admin.json('POST', '/holders', { body: { slug: 42 } });
    const uppercase = await admin.createHolder('Not-Valid');
    const duplicate = await admin.createHolder('taken');

    expect(reserved).toMatchObject({ status: 400, body: { error: { code: 'invalid', field: 'slug' } } });
    expect(shape).toMatchObject({ status: 400, body: { error: { code: 'invalid', field: 'slug' } } });
    expect(uppercase).toMatchObject({ status: 400, body: { error: { code: 'invalid', field: 'slug' } } });
    expect(duplicate).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'slug' } } });
  });

  it('records admin for an elevated Viewer and the slug for an elevated holder', async () => {
    const viewer = await elevatedViewer();
    const byViewer = await viewer.createHolder('ops');
    const holderSession = uiClient(server);
    await holderSession.login(byViewer.body.secret);
    await holderSession.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);

    const byHolder = await holderSession.createHolder('bot');

    expect(byViewer.body.updatedBy).toBe('admin');
    expect(byHolder.body.updatedBy).toBe('ops');
    expect((await holderSession.json('GET', '/me')).body).toMatchObject({ slug: 'ops', admin: { until: expect.any(String) } });
  });
});

describe('holder roster', () => {
  const server = useTestServer();

  it('is forbidden for a non-elevated Viewer and full for an elevated one', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const denied = await ui.json('GET', '/holders');

    expect(denied).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });

    await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    await ui.createHolder('zed');
    await ui.createHolder('amy', 'Amy');
    const roster = await ui.json('GET', '/holders');

    expect(roster.status).toBe(200);
    expect(roster.body.map((holder: { slug: string }) => holder.slug)).toEqual(['amy', 'zed']);
    expect(Object.keys(roster.body[0])).toEqual(expect.arrayContaining(ADMIN_FIELDS));
  });

  it('is basic for a holder session and for a bearer call', async () => {
    const admin = uiClient(server);
    await admin.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    const { body: { secret } } = await admin.createHolder('kim', 'Kim');
    const holderSession = uiClient(server);
    await holderSession.login(secret);

    const viaSession = await holderSession.json('GET', '/holders');
    const viaBearer = await apiClient(server, secret).json('GET', '/holders');

    const kim = { slug: 'kim', displayName: 'Kim', revoked: false };
    expect(viaSession.status).toBe(200);
    expect(viaSession.body).toContainEqual(kim);
    expect(viaBearer.status).toBe(200);
    expect(viaBearer.body).toContainEqual(kim);
    for (const holder of [...viaSession.body, ...viaBearer.body]) expect(Object.keys(holder)).toEqual(['slug', 'displayName', 'revoked']);
  });
});

describe('rotate and revoke', () => {
  const server = useTestServer();

  const elevatedViewer = async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    return ui;
  };

  it('rotate kills the old secret and the holder UI sessions, the new secret works', async () => {
    const admin = await elevatedViewer();
    const { body: { secret: oldSecret } } = await admin.createHolder('rob');
    const holderSession = uiClient(server);
    await holderSession.login(oldSecret);

    const rotated = await admin.json('POST', '/holders/rob/rotate');

    expect(rotated.status).toBe(200);
    expect(rotated.body.secret).toMatch(/^chr_rob_/);
    expect(rotated.body.secret).not.toBe(oldSecret);
    expect(rotated.body.secretHistory).toHaveLength(2);
    expect(rotated.body.secretHistory[0].revokedAt).toEqual(expect.any(String));
    expect(rotated.body.secretHistory[1].revokedAt).toBeNull();
    expect((await apiClient(server, oldSecret).json('GET', '/me')).status).toBe(401);
    expect((await apiClient(server, rotated.body.secret).json('GET', '/me')).body).toEqual({ slug: 'rob', displayName: null });
    expect((await holderSession.json('GET', '/me')).status).toBe(401);
  });

  it('revoke keeps the holder listed, kills every credential and refuses rotate', async () => {
    const admin = await elevatedViewer();
    const { body: { secret } } = await admin.createHolder('eve');
    const holderSession = uiClient(server);
    await holderSession.login(secret);
    await apiClient(server, secret).json('GET', '/me');

    const revoked = await admin.json('POST', '/holders/eve/revoke');

    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ slug: 'eve', revoked: true, revokedAt: expect.any(String), lastUsedAt: expect.any(String), updatedBy: 'admin' });
    expect(revoked.body.secret).toBeUndefined();
    expect((await admin.json('GET', '/holders')).body).toContainEqual(expect.objectContaining({ slug: 'eve', revoked: true }));
    expect((await apiClient(server, secret).json('GET', '/me')).status).toBe(401);
    expect((await holderSession.json('GET', '/me')).status).toBe(401);
    expect((await uiClient(server).login(secret)).status).toBe(401);
    expect(await admin.json('POST', '/holders/eve/rotate')).toMatchObject({ status: 409, body: { error: { code: 'conflict' } } });
    expect((await admin.json('POST', '/holders/eve/revoke')).status).toBe(200);
    expect((await admin.json('POST', '/holders/nobody/revoke')).status).toBe(404);
  });
});
