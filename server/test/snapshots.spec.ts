import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { bootServer, launchServer, TEST_PASSWORDS } from './harness';
import type { LaunchedServer } from './harness';
import { asRegExpSource, MANIFEST_VERSION } from './manifest-version';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../db/migrations');
const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')) as { entries: { tag: string, when: number }[] };

const storeAtMigration = (appliedCount: number) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'chartroom-'));
  const sqlite = new Database(join(dataDir, 'chartroom.sqlite'));
  sqlite.exec('CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)');
  for (const { tag, when } of journal.entries.slice(0, appliedCount)) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
    for (const statement of sqlText.split('--> statement-breakpoint')) sqlite.exec(statement);
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(createHash('sha256').update(sqlText).digest('hex'), when);
  }
  sqlite.close();
  return dataDir;
};

const IMAGE_INDEX = String(journal.entries.length - 1).padStart(4, '0');
const STAMP = /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/.source;

const markWithUnknownMigration = (dataDir: string) => {
  const sqlite = new Database(join(dataDir, 'chartroom.sqlite'));
  sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run('from-a-newer-release', 4102444800000);
  sqlite.close();
};

const placeSnapshotFile = (dataDir: string, fileName: string) => {
  const source = storeAtMigration(1);
  mkdirSync(join(dataDir, 'backups'), { recursive: true });
  copyFileSync(join(source, 'chartroom.sqlite'), join(dataDir, 'backups', fileName));
  rmSync(source, { recursive: true, force: true });
};

const backupsOf = (dataDir: string) => readdirSync(join(dataDir, 'backups'));

const migrationRows = (file: string) => {
  const sqlite = new Database(file, { readonly: true });
  try {
    return sqlite.prepare('SELECT count(*) AS count FROM __drizzle_migrations').get() as { count: number };
  }
  finally {
    sqlite.close();
  }
};

const elevatedViewer = async (server: LaunchedServer) => {
  const ui = uiClient(server);
  await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
  await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
  return ui;
};

describe('boot against a store at an older migration state', () => {
  it('writes a pre-migrate Snapshot at the old state before migrating, then serves', async () => {
    const server = await bootServer({ dataDir: storeAtMigration(3) });
    const health = await server.fetch('/health');
    await server.kill();
    const { stdout } = await server.exited;

    const [snapshotFile, ...others] = backupsOf(server.dataDir);
    expect(others).toEqual([]);
    expect(snapshotFile).toMatch(new RegExp(`^pre-migrate-0002-to-${asRegExpSource(MANIFEST_VERSION)}-${STAMP}\\.sqlite$`));
    expect(migrationRows(join(server.dataDir, 'backups', snapshotFile!))).toEqual({ count: 3 });
    expect(stdout).toContain(`pre-migrate Snapshot taken: ${join(server.dataDir, 'backups', snapshotFile!)}`);
    expect(stdout).toContain(`applied migrations: ${journal.entries.slice(3).map(entry => entry.tag).join(', ')}`);
    expect(health.status).toBe(200);
    await server.stop();
  });

  it('aborts with the store unchanged when the Snapshot cannot be written', async () => {
    const dataDir = storeAtMigration(3);
    mkdirSync(join(dataDir, 'backups'), { mode: 0o500 });

    const refused = await launchServer({ dataDir });
    const { code, stderr, stdout } = await refused.exited;
    chmodSync(join(dataDir, 'backups'), 0o700);

    expect(code).not.toBe(0);
    expect(stderr).toContain('boot failed');
    expect(stdout).not.toContain('applied migrations');
    expect(backupsOf(dataDir)).toEqual([]);

    const retried = await bootServer({ dataDir });
    await retried.kill();
    expect((await retried.exited).stdout).toMatch(new RegExp(`pre-migrate Snapshot taken: .*pre-migrate-0002-to-${asRegExpSource(MANIFEST_VERSION)}-${STAMP}\\.sqlite\\napplied migrations: 0003_comments`));
    await retried.stop();
  });
});

describe('boot against a store carrying a migration the image does not know', () => {
  it('refuses to boot, naming the pre-migrate Snapshot taken when this image upgraded the store', async () => {
    const upgraded = await bootServer({ dataDir: storeAtMigration(3) });
    await upgraded.kill();
    const [preMigrateFile] = backupsOf(upgraded.dataDir);
    markWithUnknownMigration(upgraded.dataDir);

    const older = await launchServer({ dataDir: upgraded.dataDir });
    const { code, stderr } = await older.exited;

    expect(code).not.toBe(0);
    expect(stderr).toContain(join(upgraded.dataDir, 'backups', preMigrateFile!));
    await older.stop();
  });

  it('names the newest Snapshot taken from the image\'s own schema, not a newer Snapshot from a later upgrade', async () => {
    const dataDir = storeAtMigration(journal.entries.length);
    markWithUnknownMigration(dataDir);
    const matching = `pre-migrate-${IMAGE_INDEX}-to-0.2.0-2026-01-01T00-00-00-000Z.sqlite`;
    const newestFromLaterSchema = `pre-migrate-9998-to-0.3.0-2026-02-01T00-00-00-000Z.sqlite`;
    placeSnapshotFile(dataDir, matching);
    placeSnapshotFile(dataDir, newestFromLaterSchema);

    const server = await launchServer({ dataDir });
    const { code, stderr } = await server.exited;

    expect(code).not.toBe(0);
    expect(stderr).toContain(join(dataDir, 'backups', matching));
    expect(stderr).not.toContain(newestFromLaterSchema);
    await server.stop();
  });

  it('falls back to the newest Snapshot from an older schema when none was taken from the image\'s own', async () => {
    const dataDir = storeAtMigration(journal.entries.length);
    markWithUnknownMigration(dataDir);
    const olderSchema = 'pre-migrate-0002-to-0.2.0-2026-01-01T00-00-00-000Z.sqlite';
    placeSnapshotFile(dataDir, 'pre-migrate-0001-to-0.1.5-2025-12-01T00-00-00-000Z.sqlite');
    placeSnapshotFile(dataDir, olderSchema);
    placeSnapshotFile(dataDir, 'pre-migrate-9998-to-0.3.0-2026-02-01T00-00-00-000Z.sqlite');

    const server = await launchServer({ dataDir });
    const { code, stderr } = await server.exited;

    expect(code).not.toBe(0);
    expect(stderr).toContain(join(dataDir, 'backups', olderSchema));
    expect(stderr).not.toMatch(/pre-migrate-(0001|9998)-/);
    await server.stop();
  });
});

describe('Snapshots on the UI mount', () => {
  const server = {} as LaunchedServer;

  beforeAll(async () => {
    Object.assign(server, await bootServer({ dataDir: storeAtMigration(3) }));
  });
  afterAll(() => server.stop?.());

  const takeManual = async () => (await (await elevatedViewer(server)).json('POST', '/snapshots')).body as { name: string, size: number };
  const preMigrateName = async () => ((await (await elevatedViewer(server)).json('GET', '/snapshots')).body as { name: string, trigger: string }[])
    .find(snapshot => snapshot.trigger === 'pre-migrate')!.name;

  it('an elevated session takes a manual Snapshot', async () => {
    const admin = await elevatedViewer(server);
    const before = Date.now();

    const taken = await admin.json('POST', '/snapshots');

    expect(taken).toEqual({
      status: 201,
      body: { name: expect.stringMatching(new RegExp(`^manual-${STAMP}$`)), trigger: 'manual', takenAt: expect.any(String), size: expect.any(Number) },
    });
    expect(Date.parse(taken.body.takenAt)).toBeGreaterThanOrEqual(before - 1);
    expect(taken.body.size).toBeGreaterThan(0);
    expect(backupsOf(server.dataDir)).toContain(`${taken.body.name}.sqlite`);
  });

  it('the list shows each Snapshot with trigger, time and size, newest first', async () => {
    const admin = await elevatedViewer(server);
    const taken = (await admin.json('POST', '/snapshots')).body;

    const listed = await admin.json('GET', '/snapshots');

    expect(listed.status).toBe(200);
    expect(listed.body[0]).toEqual(taken);
    expect(listed.body).toContainEqual({ name: await preMigrateName(), trigger: 'pre-migrate', takenAt: expect.any(String), size: expect.any(Number) });
  });

  it('a Snapshot downloads as a valid SQLite file', async () => {
    const { name, size } = await takeManual();

    const download = await (await elevatedViewer(server)).request('GET', `/snapshots/${name}`);
    const bytes = Buffer.from(await download.arrayBuffer());

    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('application/vnd.sqlite3');
    expect(download.headers.get('content-disposition')).toBe(`attachment; filename="${name}.sqlite"`);
    expect(bytes.subarray(0, 16).toString('latin1')).toBe('SQLite format 3\0');
    expect(bytes.length).toBe(size);
  });

  it('an elevated session deletes a manual Snapshot', async () => {
    const admin = await elevatedViewer(server);
    const { name } = await takeManual();

    expect(await admin.json('DELETE', `/snapshots/${name}`)).toEqual({ status: 204, body: null });
    expect(backupsOf(server.dataDir)).not.toContain(`${name}.sqlite`);
    expect((await admin.json('GET', '/snapshots')).body).not.toContainEqual(expect.objectContaining({ name }));
  });

  it('an unknown or path-like Snapshot name is not-found', async () => {
    const admin = await elevatedViewer(server);
    const preMigrate = await preMigrateName();

    for (const name of ['manual-2020-01-01T00-00-00-000Z', '..%2Fchartroom', encodeURIComponent(`../backups/${preMigrate}`)]) {
      expect(await admin.json('GET', `/snapshots/${name}`), name).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
      expect(await admin.json('DELETE', `/snapshots/${name}`), name).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    }
    expect(backupsOf(server.dataDir)).toContain(`${preMigrate}.sqlite`);
  });

  it('every Snapshot route is forbidden without elevation, for a Viewer and a holder session', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const holder = uiClient(server);
    await holder.login(await holderSecret(server, 'bob'));
    const { name } = await takeManual();
    const before = backupsOf(server.dataDir);

    for (const [method, path] of [['GET', '/snapshots'], ['POST', '/snapshots'], ['GET', `/snapshots/${name}`], ['DELETE', `/snapshots/${name}`]] as const) {
      expect(await viewer.json(method, path), `viewer ${method} ${path}`).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
      expect(await holder.json(method, path), `holder ${method} ${path}`).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    }
    expect(backupsOf(server.dataDir)).toEqual(before);
  });

  it('a pre-migrate Snapshot is forbidden to delete without elevation, then an elevated session deletes it', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const holder = uiClient(server);
    await holder.login(await holderSecret(server, 'dave'));
    const name = await preMigrateName();

    expect(await viewer.json('DELETE', `/snapshots/${name}`)).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    expect(await holder.json('DELETE', `/snapshots/${name}`)).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    expect(backupsOf(server.dataDir)).toContain(`${name}.sqlite`);

    expect(await (await elevatedViewer(server)).json('DELETE', `/snapshots/${name}`)).toEqual({ status: 204, body: null });
    expect(backupsOf(server.dataDir)).not.toContain(`${name}.sqlite`);
  });

  it('a failed manual Snapshot reports the error and leaves no file behind', async () => {
    const admin = await elevatedViewer(server);
    const before = backupsOf(server.dataDir);
    chmodSync(join(server.dataDir, 'backups'), 0o500);
    try {
      expect(await admin.json('POST', '/snapshots')).toEqual({ status: 500, body: { error: { code: 'internal', message: expect.stringMatching(/^Snapshot failed: .+/) } } });
    }
    finally {
      chmodSync(join(server.dataDir, 'backups'), 0o700);
    }
    expect(backupsOf(server.dataDir)).toEqual(before);
  });

  it('the bearer API has no Snapshot routes', async () => {
    const bearer = apiClient(server, await holderSecret(server, 'carol'));

    for (const [method, path] of [['GET', '/snapshots'], ['POST', '/snapshots']] as const) {
      expect(await bearer.json(method, path), `${method} ${path}`).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    }
  });
});
