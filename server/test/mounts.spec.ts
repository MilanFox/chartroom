import { describe, expect, it } from 'vitest';
import { apiClient, uiClient } from './clients';
import { bootServer, TEST_PASSWORDS, useTestServer } from './harness';

describe('the two mounts', () => {
  const server = useTestServer();

  let secretOnce: Promise<string> | undefined;
  const holderSecret = () => {
    secretOnce ??= (async () => {
      const admin = uiClient(server);
      await admin.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
      await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
      const { body } = await admin.createHolder('api-user', 'API user');
      return body.secret as string;
    })();
    return secretOnce;
  };

  it('a holder secret works as bearer on /api/v1/me', async () => {
    const secret = await holderSecret();

    const me = await apiClient(server, secret).json('GET', '/me');

    expect(me).toEqual({ status: 200, body: { slug: 'api-user', displayName: 'API user' } });
  });

  it('a session cookie on /api/v1 is ignored', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const me = await apiClient(server).json('GET', '/me', { headers: { cookie: ui.cookie! } });

    expect(me).toMatchObject({ status: 401, body: { error: { code: 'unauthenticated' } } });
  });

  it('a bearer header on /ui is ignored', async () => {
    const secret = await holderSecret();

    const me = await uiClient(server).json('GET', '/me', { headers: { authorization: `Bearer ${secret}` } });

    expect(me).toMatchObject({ status: 401, body: { error: { code: 'unauthenticated' } } });
  });

  it('a /ui write with a foreign or missing Origin is forbidden', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const foreign = await ui.json('POST', '/elevate', { body: { password: TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD }, headers: { origin: 'https://evil.example' } });
    const missing = await ui.request('POST', '/elevate', { body: { password: TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD }, headers: { origin: '' } });

    expect(foreign).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    expect(missing.status).toBe(403);
    expect((await ui.json('GET', '/me')).body.admin).toBeNull();
  });

  it('a Viewer write on /ui is forbidden', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const created = await ui.createHolder('nope');

    expect(created).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
  });

  it('a public route is matched on its pathname, query string aside', async () => {
    const ui = uiClient(server);

    const { status } = await ui.json('POST', '/login?next=%2F', { body: { secret: TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD } });

    expect(status).toBe(200);
  });

  it('an authenticated /ui request re-issues the session cookie so it slides', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const response = await ui.request('GET', '/me');

    expect(response.headers.get('set-cookie')).toMatch(/^chartroom_session=.+Max-Age=2592000/);
  });

  it('an unknown route is not-found with the JSON error body', async () => {
    const secret = await holderSecret();

    const missing = await apiClient(server, secret).json('GET', '/unknown');

    expect(missing).toEqual({ status: 404, body: { error: { code: 'not-found', message: 'no such route' } } });
  });
});

describe('CHARTROOM_BASE_URL with a path', () => {
  it('compares the Origin of a /ui write against the base URL origin', async () => {
    const server = await bootServer({ env: { CHARTROOM_BASE_URL: 'https://tracker.example/chartroom/' } });
    const ui = uiClient(server);

    const accepted = await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD, { origin: 'https://tracker.example' });
    const refused = await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD, { origin: server.baseUrl });

    expect(accepted.status).toBe(200);
    expect(refused).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    await server.stop();
  });
});
