import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { bootServer, TEST_PASSWORDS } from './harness';
import type { LaunchedServer } from './harness';
import { MANIFEST_VERSION, NEXT_MINOR_VERSION } from './manifest-version';

const NEWER_RELEASE = { tag_name: `v${NEXT_MINOR_VERSION}`, html_url: `https://github.com/milanfox/chartroom/releases/tag/v${NEXT_MINOR_VERSION}` };

const releaseStub = async (respond: { status: number, body: unknown }) => {
  let requests = 0;
  const stub = createServer((_, response) => {
    requests += 1;
    response.writeHead(respond.status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(respond.body));
  });
  await new Promise<void>(listening => stub.listen(0, '127.0.0.1', listening));
  const { port } = stub.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/repos/milanfox/chartroom/releases/latest`,
    get requests() {
      return requests;
    },
    close: () => new Promise<void>(closed => stub.close(() => closed())),
  };
};

const elevatedSession = async (server: LaunchedServer) => {
  const admin = uiClient(server);
  await admin.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
  await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
  return admin;
};

const updateAvailableFor = async (client: { json: ReturnType<typeof uiClient>['json'] }) => (await client.json('GET', '/instance')).body.updateAvailable;

describe('a newer release on the release endpoint', () => {
  let stub: Awaited<ReturnType<typeof releaseStub>>;
  let server: LaunchedServer;

  beforeAll(async () => {
    stub = await releaseStub({ status: 200, body: NEWER_RELEASE });
    server = await bootServer({ env: { CHARTROOM_RELEASE_URL: stub.url } });
  });

  afterAll(async () => {
    await server.stop();
    await stub.close();
  });

  it('an elevated session reads the newer version and its release notes url on the UI mount', async () => {
    const admin = await elevatedSession(server);

    await vi.waitFor(async () => expect(await updateAvailableFor(admin)).toEqual({ version: NEXT_MINOR_VERSION, url: NEWER_RELEASE.html_url }));
  });

  it('a holder session, a Viewer and every bearer call read null', async () => {
    const admin = await elevatedSession(server);
    await vi.waitFor(async () => expect(await updateAvailableFor(admin)).not.toBeNull());
    const secret = await holderSecret(server, 'alice');
    const holder = uiClient(server);
    await holder.login(secret);
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(await updateAvailableFor(holder)).toBeNull();
    expect(await updateAvailableFor(viewer)).toBeNull();
    expect(await updateAvailableFor(apiClient(server, secret))).toBeNull();
  });

  it('is gone from the session once elevation is dropped', async () => {
    const admin = await elevatedSession(server);
    await vi.waitFor(async () => expect(await updateAvailableFor(admin)).not.toBeNull());

    await admin.json('DELETE', '/elevate');

    expect(await updateAvailableFor(admin)).toBeNull();
  });
});

describe('the update check switched off', () => {
  let stub: Awaited<ReturnType<typeof releaseStub>>;
  let server: LaunchedServer;

  beforeAll(async () => {
    stub = await releaseStub({ status: 200, body: NEWER_RELEASE });
    server = await bootServer({ env: { CHARTROOM_RELEASE_URL: stub.url, CHARTROOM_UPDATE_CHECK: 'false' } });
  });

  afterAll(async () => {
    await server.stop();
    await stub.close();
  });

  it('fetches nothing and reads null for an elevated session', async () => {
    const admin = await elevatedSession(server);
    await new Promise(settled => setTimeout(settled, 300));

    expect(await updateAvailableFor(admin)).toBeNull();
    expect(stub.requests).toBe(0);
  });
});

describe('a release that is not newer', () => {
  it.each([`v${MANIFEST_VERSION}`, 'v0.0.9', `v${MANIFEST_VERSION}-rc.1`])('%s reads null for an elevated session', async (tag) => {
    const stub = await releaseStub({ status: 200, body: { ...NEWER_RELEASE, tag_name: tag } });
    const server = await bootServer({ env: { CHARTROOM_RELEASE_URL: stub.url } });
    const admin = await elevatedSession(server);

    await vi.waitFor(() => expect(stub.requests).toBe(1));
    expect(await updateAvailableFor(admin)).toBeNull();
    await server.stop();
    await stub.close();
  });
});

describe('a failing release endpoint', () => {
  it('stays silent: reads null, keeps serving and logs one debug line', async () => {
    const stub = await releaseStub({ status: 500, body: { message: 'boom' } });
    const server = await bootServer({ env: { CHARTROOM_RELEASE_URL: stub.url } });
    const admin = await elevatedSession(server);

    await vi.waitFor(() => expect(stub.requests).toBe(1));
    expect(await updateAvailableFor(admin)).toBeNull();
    expect((await server.fetch('/health')).status).toBe(200);
    await server.kill();
    const { stdout, stderr } = await server.exited;
    expect(stdout.match(/^\[debug\] update check failed: .*500/gm)).toHaveLength(1);
    expect(stderr).not.toContain('update check');
    await server.stop();
    await stub.close();
  });
});
