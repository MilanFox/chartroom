import { join } from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';

const MAX_BYTES = 512 * 1024;
const notFound = { status: 404, body: { error: { code: 'not-found' } } };
const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
type Client = ReturnType<typeof apiClient>;

describe('research notes', () => {
  const server = useTestServer();
  let alice: Client;
  let bob: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
    bob = apiClient(server, await holderSecret(server, 'bob', 'Bob'));
  });

  const create = async (kind: string, title: string, extra: Record<string, unknown> = {}) =>
    (await alice.json('POST', '/issues', { body: { kind, title, ...extra } })).body;

  const put = (client: Client, note: string, body: unknown) =>
    client.json('PUT', `/issues/${note.replace('/', '/research/')}`, { body: { body } });

  it('creates a note with 201, replaces it with 200 keeping createdAt and createdBy, and serves it with and without the body', async () => {
    const ticket = await create('ticket', 'Research');

    const created = await put(alice, `${ticket.number}/local-transcription`, '# Local transcription\n\nWhisper runs offline.');
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      issue: ticket.number,
      slug: 'local-transcription',
      title: 'Local transcription',
      size: 44,
      body: '# Local transcription\n\nWhisper runs offline.',
      createdAt: expect.any(String),
      createdBy: 'alice',
      updatedAt: created.body.createdAt,
      updatedBy: 'alice',
      origin: 'api',
      url: `${server.baseUrl}/issues/${ticket.number}/research/local-transcription`,
    });

    await sleep(5);
    const replaced = await put(bob, `${ticket.number}/local-transcription`, 'Intro\n\n# Revised ✓\n');
    expect(replaced.status).toBe(200);
    expect(replaced.body).toMatchObject({ title: 'Revised ✓', size: 21, body: 'Intro\n\n# Revised ✓\n', createdAt: created.body.createdAt, createdBy: 'alice', updatedBy: 'bob' });
    expect(replaced.body.updatedAt > created.body.updatedAt).toBe(true);

    expect((await put(alice, `${ticket.number}/untitled`, 'no heading')).body.title).toBe('untitled');
    const listed = (await alice.json('GET', `/issues/${ticket.number}/research`)).body;
    expect(listed.map((note: { slug: string }) => note.slug)).toEqual(['local-transcription', 'untitled']);
    expect(listed[0]).not.toHaveProperty('body');
    expect(listed[0]).toEqual(Object.fromEntries(Object.entries(replaced.body).filter(([key]) => key !== 'body')));
    expect(await alice.json('GET', `/issues/${ticket.number}/research/local-transcription`)).toEqual({ status: 200, body: replaced.body });

    expect(await alice.json('GET', `/issues/${ticket.number}/research/missing`)).toMatchObject(notFound);
    expect(await alice.json('GET', '/issues/999999/research')).toMatchObject(notFound);
    expect(await alice.json('GET', '/issues/999999/research/local-transcription')).toMatchObject(notFound);
    expect(await put(alice, '999999/x', 'x')).toMatchObject(notFound);
  });

  it('takes puts on every Kind, open or closed', async () => {
    const effort = await create('effort', 'Effort', { name: 'notes-kinds' });
    const map = await create('map', 'Map', { parent: effort.number });
    const spec = await create('spec', 'Spec', { parent: effort.number });
    const ticket = await create('ticket', 'Ticket', { parent: map.number });
    await alice.json('POST', `/issues/${ticket.number}/close`);

    for (const issue of [effort, map, spec, ticket]) {
      expect((await put(alice, `${issue.number}/finding`, `# On ${issue.kind}`)).status).toBe(201);
    }
    expect((await put(alice, `${ticket.number}/finding`, '# Corrected after close')).status).toBe(200);
  });

  it('accepts 512 KB and refuses one byte more or a NUL byte as invalid on body with the Artifact Link hint; a bad slug is invalid on slug', async () => {
    const ticket = await create('ticket', 'Limits');

    expect((await put(alice, `${ticket.number}/at-cap`, 'a'.repeat(MAX_BYTES))).body.size).toBe(MAX_BYTES);
    for (const body of ['a'.repeat(MAX_BYTES + 1), `${'é'.repeat(MAX_BYTES / 2)}a`, 'text\0binary']) {
      const refused = await put(alice, `${ticket.number}/too-much`, body);
      expect(refused).toMatchObject(invalidOn('body'));
      expect(refused.body.error.message).toContain('chartroom issue link add <n> --role artifact');
    }
    expect(await put(alice, `${ticket.number}/not-a-string`, 42)).toMatchObject(invalidOn('body'));
    for (const slug of ['Upper', 'with_underscore', 'trailing-', 'two--dashes', 'sp%20ace']) {
      expect(await put(alice, `${ticket.number}/${slug}`, 'x')).toMatchObject(invalidOn('slug'));
    }
    expect(await alice.json('GET', `/issues/${ticket.number}/research`)).toMatchObject({ body: [{ slug: 'at-cap' }] });
  });

  it('records a research Change per put with slug and size, never the body', async () => {
    const ticket = await create('ticket', 'Changes');
    await put(alice, `${ticket.number}/audit`, 'secret-ish finding text');
    await put(bob, `${ticket.number}/audit`, 'shorter');

    const changes = (await alice.json('GET', `/issues/${ticket.number}/changes?field=research`)).body.items;
    expect(changes).toMatchObject([
      { field: 'research', actor: 'alice', before: null, after: 'audit (23 bytes)' },
      { field: 'research', actor: 'bob', before: 'audit (23 bytes)', after: 'audit (7 bytes)' },
    ]);
    expect(JSON.stringify(changes)).not.toMatch(/finding text|shorter/);
    expect((await alice.json('GET', `/issues/${ticket.number}`)).body.version).toBe(1);
  });

  it('a Viewer session reads notes on /ui but a put is forbidden', async () => {
    const ticket = await create('ticket', 'Viewer');
    await put(alice, `${ticket.number}/seen`, '# Seen');
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(await viewer.json('GET', `/issues/${ticket.number}/research/seen`)).toMatchObject({ status: 200, body: { title: 'Seen' } });
    expect(await viewer.json('PUT', `/issues/${ticket.number}/research/seen`, { body: { body: 'x' } })).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
  });

  it('deleting the issue deletes its notes', async () => {
    const ticket = await create('ticket', 'Doomed');
    await put(alice, `${ticket.number}/gone`, '# Gone');
    const survivor = await create('ticket', 'Survivor');
    await put(alice, `${survivor.number}/gone`, '# Stays');

    expect((await alice.json('DELETE', `/issues/${ticket.number}`)).status).toBe(204);
    expect(await alice.json('GET', `/issues/${ticket.number}/research/gone`)).toMatchObject(notFound);
    const sqlite = new Database(join(server.dataDir, 'chartroom.sqlite'), { readonly: true });
    expect(sqlite.prepare('SELECT issue FROM research_notes WHERE issue IN (?, ?)').all(ticket.number, survivor.number)).toEqual([{ issue: survivor.number }]);
    sqlite.close();
    expect(await alice.json('GET', `/issues/${survivor.number}/research/gone`)).toMatchObject({ status: 200, body: { title: 'Stays' } });
  });
});
