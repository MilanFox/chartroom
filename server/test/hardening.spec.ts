import { describe, expect, it } from 'vitest';
import { apiClient, uiClient } from './clients';
import { bootServer, TEST_PASSWORDS, useTestServer } from './harness';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': 'frame-ancestors \'none\'',
  'cross-origin-opener-policy': 'same-origin',
};

const repeat = (times: number, action: () => Promise<unknown>) =>
  Array.from({ length: times }).reduce<Promise<unknown>>(chain => chain.then(action), Promise.resolve());

describe('security headers and JSON-only bodies', () => {
  const server = useTestServer();

  it.each([
    ['/health', 200],
    ['/ui/me', 401],
    ['/api/v1/unknown', 401],
    ['/', 200],
  ])('every response carries the security headers: %s', async (path, status) => {
    const response = await server.fetch(path);

    expect(response.status).toBe(status);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name), name).toBe(value);
    expect(response.headers.get('strict-transport-security')).toBeNull();
    if (path.startsWith('/ui/') || path.startsWith('/api/')) expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('a write with a text/plain body is 415', async () => {
    const ui = uiClient(server);

    const login = await ui.json('POST', '/login', { rawBody: 'secret=viewer-secret', headers: { 'content-type': 'text/plain' } });

    expect(login).toEqual({ status: 415, body: { error: { code: 'invalid', message: 'request body must be application/json' } } });
  });

  it('a malformed JSON body is invalid', async () => {
    const ui = uiClient(server);

    const login = await ui.json('POST', '/login', { rawBody: '{"secret":', headers: { 'content-type': 'application/json' } });

    expect(login).toMatchObject({ status: 400, body: { error: { code: 'invalid' } } });
  });
});

describe('rate limit on auth failures', () => {
  it('the eleventh failed login from one IP within a minute is rate-limited', async () => {
    const server = await bootServer();
    const ui = uiClient(server);

    await repeat(10, () => ui.login('wrong'));
    const eleventh = await ui.login('wrong');
    const correct = await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(eleventh).toMatchObject({ status: 429, body: { error: { code: 'rate-limited' } } });
    expect(correct.status).toBe(429);
    await server.stop();
  });

  it('failed elevations count and a correct elevation is then refused', async () => {
    const server = await bootServer();
    const ui = uiClient(server);
    await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    await repeat(10, () => ui.elevate('wrong'));
    const eleventh = await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);

    expect(eleventh).toMatchObject({ status: 429, body: { error: { code: 'rate-limited' } } });
    await server.stop();
  });

  it('bad bearers count and then limit the API', async () => {
    const server = await bootServer();
    const api = apiClient(server, 'chr_nobody_0000');

    await repeat(10, () => api.json('GET', '/me'));
    const eleventh = await api.json('GET', '/me');

    expect(eleventh).toMatchObject({ status: 429, body: { error: { code: 'rate-limited' } } });
    await server.stop();
  });

  it('successful requests are never limited', async () => {
    const server = await bootServer();
    const ui = uiClient(server);

    await repeat(15, () => ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD));
    const login = await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(login.status).toBe(200);
    await server.stop();
  });

  it('with CHARTROOM_TRUST_PROXY the forwarded address is the one counted', async () => {
    const server = await bootServer({ env: { CHARTROOM_TRUST_PROXY: 'true' } });
    const fromA = () => uiClient(server).login('wrong', { 'x-forwarded-for': '203.0.113.7' });

    await repeat(10, fromA);
    const limitedA = await fromA();
    const freshB = await uiClient(server).login('wrong', { 'x-forwarded-for': '203.0.113.8' });

    expect(limitedA.status).toBe(429);
    expect(freshB.status).toBe(401);
    await server.stop();
  });

  it('without CHARTROOM_TRUST_PROXY the forwarded address is ignored', async () => {
    const server = await bootServer();
    const forwarded = (ip: string) => uiClient(server).login('wrong', { 'x-forwarded-for': ip });

    await repeat(10, () => forwarded('203.0.113.7'));
    const otherForwardedIp = await forwarded('203.0.113.8');

    expect(otherForwardedIp.status).toBe(429);
    await server.stop();
  });
});
