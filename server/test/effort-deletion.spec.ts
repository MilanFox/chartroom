import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';
import type { LaunchedServer } from './harness';
import type { Handler } from '../http/table';

type ApiClient = ReturnType<typeof apiClient>;
type UiClient = ReturnType<typeof uiClient>;

const STAMP = /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/.source;
const ROW_TABLES = ['issues', 'comments', 'changes', 'links', 'issue_labels', 'issue_blockers', 'research_notes'] as const;
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

const elevatedViewer = async (server: LaunchedServer) => {
  const ui = uiClient(server);
  await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
  await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
  return ui;
};

const backupsOf = (server: LaunchedServer) => readdirSync(join(server.dataDir, 'backups'));

const storeSize = (server: LaunchedServer) => {
  const file = join(server.dataDir, 'chartroom.sqlite');
  return statSync(file).size + (existsSync(`${file}-wal`) ? statSync(`${file}-wal`).size : 0);
};

const readOnly = <T>(file: string, read: Handler<[Database.Database], T>) => {
  const database = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return read(database);
  }
  finally {
    database.close();
  }
};

const orphanCounts = (server: LaunchedServer, numbers: number[]) => readOnly(join(server.dataDir, 'chartroom.sqlite'), database =>
  Object.fromEntries(ROW_TABLES.map((table) => {
    const column = table === 'issues' ? 'number' : 'issue';
    const extra = table === 'issue_blockers' ? ` OR blocker IN (${numbers.join(',')})` : '';
    const { total } = database.prepare(`SELECT count(*) AS total FROM ${table} WHERE ${column} IN (${numbers.join(',')})${extra}`).get() as { total: number };
    return [table, total];
  })));

describe('deleting a closed Effort', () => {
  const server = useTestServer();
  let alice: ApiClient;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const create = async (kind: string, title: string, extra: Record<string, unknown> = {}) =>
    (await alice.json('POST', '/issues', { body: { kind, title, ...extra } })).body as { number: number };

  const seedEffort = async (name: string, ticketBody = '') => {
    const effort = await create('effort', `Effort ${name}`, { name });
    const map = await create('map', `Map ${name}`, { parent: effort.number });
    const spec = await create('spec', `Spec ${name}`, { parent: effort.number });
    const tickets = [
      await create('ticket', `Decision ${name}`, { parent: map.number, body: ticketBody }),
      await create('ticket', `Build ${name}`, { parent: spec.number, body: ticketBody }),
    ];
    await alice.json('POST', `/issues/${tickets[0]!.number}/comments`, { body: { body: 'First thought' } });
    await alice.json('POST', `/issues/${tickets[1]!.number}/comments`, { body: { body: 'Second thought' } });
    await alice.json('PUT', `/issues/${tickets[1]!.number}/labels/bug`);
    await alice.json('PUT', `/issues/${tickets[1]!.number}/research/findings`, { body: { body: '# Findings' } });
    await alice.json('POST', `/issues/${effort.number}/links`, { body: { role: 'artifact', type: 'branch', title: 'Branch', url: `git:${name}` } });
    await alice.json('PATCH', `/issues/${spec.number}`, { body: { title: `Spec ${name} renamed` } });
    return { effort, map, spec, tickets, numbers: [effort.number, map.number, spec.number, ...tickets.map(ticket => ticket.number)] };
  };

  const closeEffort = (number: number) => alice.json('POST', `/issues/${number}/close`, { body: {} });

  it('lists only closed Efforts with their counts, oldest last activity first; a late comment moves one', async () => {
    const admin = await elevatedViewer(server);
    const older = await seedEffort('listed-older');
    await closeEffort(older.effort.number);
    await sleep(5);
    const newer = await seedEffort('listed-newer');
    await closeEffort(newer.effort.number);
    const open = await seedEffort('listed-open');

    const listed = (await admin.json('GET', '/admin/closed-efforts')).body as { number: number, lastActivityAt: string }[];
    const ours = listed.filter(effort => [older, newer, open].some(seeded => seeded.effort.number === effort.number));

    expect(ours.map(effort => effort.number)).toEqual([older.effort.number, newer.effort.number]);
    expect(ours[0]).toEqual({
      number: older.effort.number,
      name: 'listed-older',
      title: 'Effort listed-older',
      closedAt: expect.any(String),
      lastActivityAt: expect.any(String),
      counts: { issues: 4, comments: 2, links: 1, changes: 5, researchNotes: 1 },
    });

    await sleep(5);
    const late = (await alice.json('POST', `/issues/${older.tickets[0]!.number}/comments`, { body: { body: 'Late thought' } })).body as { createdAt: string };
    const relisted = (await admin.json('GET', '/admin/closed-efforts')).body as { number: number, lastActivityAt: string, counts: { comments: number } }[];
    const moved = relisted.find(effort => effort.number === older.effort.number)!;

    expect(moved.lastActivityAt).toBe(late.createdAt);
    expect(moved.counts.comments).toBe(3);
    expect(relisted.findIndex(effort => effort.number === older.effort.number)).toBeGreaterThan(relisted.findIndex(effort => effort.number === newer.effort.number));
  });

  it('deletes the whole subtree after a pre-delete Snapshot, records blocker removals outside it and shrinks the store', async () => {
    const admin = await elevatedViewer(server);
    const doomed = await seedEffort('doomed', 'x'.repeat(200_000));
    const survivor = await seedEffort('survivor');
    const blocked = survivor.tickets[0]!.number;
    await alice.json('PUT', `/issues/${blocked}/blockers/${doomed.tickets[1]!.number}`);
    await closeEffort(doomed.effort.number);
    const sizeBefore = storeSize(server);

    const deletion = await admin.json('DELETE', '/efforts/doomed');

    expect(deletion).toEqual({
      status: 200,
      body: {
        snapshot: { name: expect.stringMatching(new RegExp(`^pre-delete-doomed-${STAMP}$`)), trigger: 'pre-delete', takenAt: expect.any(String), size: expect.any(Number) },
        deleted: { issues: 4, comments: 2, links: 1, changes: 5, researchNotes: 1 },
        vacuumed: true,
      },
    });
    for (const number of doomed.numbers) {
      expect(await alice.json('GET', `/issues/${number}`), `#${number}`).toMatchObject({ status: 404 });
    }
    expect(orphanCounts(server, doomed.numbers)).toEqual(Object.fromEntries(ROW_TABLES.map(table => [table, 0])));
    expect(storeSize(server)).toBeLessThan(sizeBefore);

    const changes = (await alice.json('GET', `/issues/${blocked}/changes?field=blocker`)).body.items as { actor: string, before: string, after: string | null }[];
    expect(changes.at(-1)).toMatchObject({ actor: 'admin', before: `#${doomed.tickets[1]!.number} Build doomed`, after: null });
    expect((await alice.json('GET', `/issues/${blocked}`)).body.blockedBy).toEqual([]);

    const snapshotFile = join(server.dataDir, 'backups', `${deletion.body.snapshot.name}.sqlite`);
    const keptTitle = readOnly(snapshotFile, database => database.prepare('SELECT title FROM issues WHERE number = ?').get(doomed.effort.number));
    expect(keptTitle).toEqual({ title: 'Effort doomed' });
    expect((await admin.json('GET', '/snapshots')).body).toContainEqual(deletion.body.snapshot);
  });

  it('refuses an open Effort with conflict and changes nothing', async () => {
    const admin = await elevatedViewer(server);
    const open = await seedEffort('still-open');
    const before = backupsOf(server);

    expect(await admin.json('DELETE', `/efforts/${open.effort.number}`)).toMatchObject({ status: 409, body: { error: { code: 'conflict' } } });
    expect(backupsOf(server)).toEqual(before);
    expect(orphanCounts(server, open.numbers).issues).toBe(open.numbers.length);
  });

  it('answers not-found for a missing Effort and invalid for a number that is not one', async () => {
    const admin = await elevatedViewer(server);
    const other = await seedEffort('not-an-effort');

    expect(await admin.json('DELETE', '/efforts/999999')).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(await admin.json('DELETE', `/efforts/${other.tickets[0]!.number}`)).toMatchObject({ status: 400, body: { error: { code: 'invalid', field: 'handle' } } });
  });

  it('deletes nothing and reports internal when the Snapshot fails', async () => {
    const admin = await elevatedViewer(server);
    const kept = await seedEffort('snapshot-fails');
    await closeEffort(kept.effort.number);
    const before = backupsOf(server);
    chmodSync(join(server.dataDir, 'backups'), 0o500);
    try {
      expect(await admin.json('DELETE', '/efforts/snapshot-fails')).toEqual({ status: 500, body: { error: { code: 'internal', message: expect.stringMatching(/^Snapshot failed: .+/) } } });
    }
    finally {
      chmodSync(join(server.dataDir, 'backups'), 0o700);
    }
    expect(backupsOf(server)).toEqual(before);
    expect(orphanCounts(server, kept.numbers)).toMatchObject({ issues: kept.numbers.length, comments: 2, links: 1 });
  });

  it('is forbidden to a non-elevated Viewer and holder session, and absent from the bearer API', async () => {
    const closed = await seedEffort('guarded');
    await closeEffort(closed.effort.number);
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const holder: UiClient = uiClient(server);
    await holder.login(await holderSecret(server, 'bob'));

    for (const client of [viewer, holder]) {
      expect(await client.json('GET', '/admin/closed-efforts')).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
      expect(await client.json('DELETE', '/efforts/guarded')).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    }
    expect(await alice.json('DELETE', '/efforts/guarded')).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(await alice.json('GET', '/admin/closed-efforts')).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(orphanCounts(server, closed.numbers).issues).toBe(closed.numbers.length);
  });
});
