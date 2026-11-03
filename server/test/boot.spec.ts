import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bootServer, launchServer, useTestServer } from './harness';

describe('boot with both passwords', () => {
  const server = useTestServer();

  it('creates the store with its WAL siblings and backups/ in the data dir', () => {
    for (const name of ['chartroom.sqlite', 'chartroom.sqlite-wal', 'chartroom.sqlite-shm', 'backups']) {
      expect(existsSync(join(server.dataDir, name)), name).toBe(true);
    }
  });

  it('answers GET /health with ok and the manifest version', async () => {
    const response = await server.fetch('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, version: '0.1.0' });
  });
});

describe('boot without a required password', () => {
  it.each(['CHARTROOM_ADMIN_PASSWORD', 'CHARTROOM_VIEWER_PASSWORD'])('exits non-zero naming %s and creates no file', async (variable) => {
    const server = await launchServer({ env: { [variable]: '' } });
    const { code, stderr } = await server.exited;

    expect(code).not.toBe(0);
    expect(stderr).toContain(variable);
    expect(readdirSync(server.dataDir)).toEqual([]);
    await server.stop();
  });
});

describe('second boot on the same data dir', () => {
  it('is healthy and runs no migration again', async () => {
    const first = await bootServer();
    await first.kill();
    expect((await first.exited).stdout).toContain('applied migrations: 0000_label-groups');

    const second = await bootServer({ dataDir: first.dataDir });
    const response = await second.fetch('/health');
    await second.kill();

    expect(response.status).toBe(200);
    expect((await second.exited).stdout).toContain('schema up to date');
    await second.stop();
  });
});

describe('two servers through the harness', () => {
  it('never share a store or a port, and a stopped server leaves no data dir behind', async () => {
    const [one, two] = await Promise.all([bootServer(), bootServer()]);

    expect(one.port).not.toBe(two.port);
    expect(one.dataDir).not.toBe(two.dataDir);

    await one.stop();
    expect(existsSync(one.dataDir)).toBe(false);
    expect((await two.fetch('/health')).status).toBe(200);
    await two.stop();
  });
});
