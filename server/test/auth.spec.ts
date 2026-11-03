import { describe, expect, it } from 'vitest';
import { uiClient } from './clients';
import { bootServer, TEST_PASSWORDS, useTestServer } from './harness';

const HOUR_MS = 60 * 60 * 1000;
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

describe('login', () => {
  const server = useTestServer();

  it('with the viewer password yields a Viewer session', async () => {
    const ui = uiClient(server);

    const login = await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(login.status).toBe(200);
    expect(login.body).toEqual({ slug: null, displayName: null, viewer: true, admin: null });
    expect(await ui.json('GET', '/me')).toEqual({ status: 200, body: { slug: null, displayName: null, viewer: true, admin: null } });
  });

  it('with a holder secret yields a holder session', async () => {
    const admin = uiClient(server);
    await admin.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    const created = await admin.createHolder('ada', 'Ada Lovelace');
    const ui = uiClient(server);

    const login = await ui.login(created.body.secret);

    expect(login.status).toBe(200);
    expect(login.body).toEqual({ slug: 'ada', displayName: 'Ada Lovelace', viewer: false, admin: null });
    expect((await ui.json('GET', '/me')).body).toEqual({ slug: 'ada', displayName: 'Ada Lovelace', viewer: false, admin: null });
  });

  it('with anything else is unauthenticated and sets no cookie', async () => {
    const ui = uiClient(server);

    const login = await ui.login('not-a-secret');

    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('unauthenticated');
    expect(ui.cookie).toBeNull();
  });

  it('without a cookie /ui/me is unauthenticated', async () => {
    const ui = uiClient(server);

    const me = await ui.json('GET', '/me');

    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('unauthenticated');
  });

  it('sets an httpOnly, SameSite=Lax session cookie for 30 days', async () => {
    const ui = uiClient(server);

    const response = await ui.request('POST', '/login', { body: { secret: TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD } });
    const cookie = response.headers.get('set-cookie')!;

    expect(cookie).toMatch(/^chartroom_session=[A-Za-z0-9_-]+;/);
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  it('logout clears the cookie and ends the session', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const session = ui.cookie!;

    const logout = await ui.request('POST', '/logout');

    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toMatch(/^chartroom_session=;.*Max-Age=0/);
    expect((await ui.json('GET', '/me', { headers: { cookie: session } })).status).toBe(401);
  });
});

describe('elevation', () => {
  const server = useTestServer();

  it('with the admin password reports admin.until about one hour out and does not slide', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const before = Date.now();
    const elevated = await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    const until = Date.parse(elevated.body.admin.until);

    expect(elevated.status).toBe(200);
    expect(until - before).toBeGreaterThanOrEqual(HOUR_MS - 1000);
    expect(until - before).toBeLessThanOrEqual(HOUR_MS + 5000);
    expect((await ui.json('GET', '/me')).body.admin).toEqual({ until: elevated.body.admin.until });

    await sleep(20);
    const again = await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);

    expect(again.body.admin.until).toBe(elevated.body.admin.until);
  });

  it('with a wrong password is unauthenticated and leaves the session unelevated', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const elevated = await ui.elevate('wrong');

    expect(elevated.status).toBe(401);
    expect(elevated.body.error.code).toBe('unauthenticated');
    expect((await ui.json('GET', '/me')).body.admin).toBeNull();
  });

  it('drop ends elevation early', async () => {
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);

    const dropped = await ui.json('DELETE', '/elevate');

    expect(dropped).toEqual({ status: 200, body: { slug: null, displayName: null, viewer: true, admin: null } });
    expect((await ui.json('GET', '/me')).body.admin).toBeNull();
    expect((await ui.createHolder('late')).status).toBe(403);
  });

  it('expires after the configured window, after which admin routes are forbidden', async () => {
    const short = await bootServer({ env: { CHARTROOM_ELEVATION_SECONDS: '1' } });
    const ui = uiClient(short);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    expect((await ui.createHolder('early')).status).toBe(201);

    await sleep(1100);
    const late = await ui.createHolder('late');

    expect(late.status).toBe(403);
    expect(late.body.error.code).toBe('forbidden');
    expect((await ui.json('GET', '/me')).body.admin).toBeNull();
    await short.stop();
  });
});
