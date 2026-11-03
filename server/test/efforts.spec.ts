import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret } from './clients';
import { useTestServer } from './harness';

const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });
const notFound = { status: 404, body: { error: { code: 'not-found' } } };
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
type Client = ReturnType<typeof apiClient>;
let alice: Client;
const create = async (kind: string, title: string, extra: Record<string, unknown> = {}) =>
  (await alice.json('POST', '/issues', { body: { kind, title, ...extra } })).body;
const addLink = (client: Client, number: number, link: Record<string, unknown>) =>
  client.json('POST', `/issues/${number}/links`, { body: { role: 'artifact', type: 'branch', title: 'X', ...link } });

describe('efforts', () => {
  const server = useTestServer();

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const chart = async (name: string) => {
    const effort = await create('effort', `Effort ${name}`, { name });
    const map = await create('map', `Map ${name}`, { parent: effort.number });
    return { effort, map };
  };

  it('resolves an Effort by slug or number to the same Effort document; a ticket number is invalid; lists sorted by updatedAt and name', async () => {
    const { effort: tracker, map } = await chart('tracker');
    await sleep(5);
    const adapter = await create('effort', 'Effort adapter', { name: 'adapter' });
    const ticket = await create('ticket', 'T', { parent: map.number });

    const bySlug = (await alice.json('GET', '/efforts/tracker')).body;
    const byNumber = (await alice.json('GET', `/efforts/${tracker.number}`)).body;
    expect(bySlug).toEqual(byNumber);
    expect(bySlug).toMatchObject({ number: tracker.number, kind: 'effort', name: 'tracker', testInstructions: null, children: [map.number], specs: [], links: [] });
    expect(bySlug.map).toMatchObject({ number: map.number, kind: 'map', title: 'Map tracker' });
    expect(bySlug.map).not.toHaveProperty('body');
    expect(bySlug.linkRollup).toEqual({ resource: [], artifact: [] });
    expect(bySlug.statusRollup).toMatchObject({ open: 2 });
    expect((await alice.json('GET', `/efforts/${adapter.number}`)).body.map).toBeNull();
    expect(await alice.json('GET', `/efforts/${ticket.number}`)).toMatchObject(invalidOn('handle'));
    expect(await alice.json('GET', '/efforts/999999')).toMatchObject(notFound);
    expect(await alice.json('GET', '/efforts/no-such')).toMatchObject(notFound);
    expect(await alice.json('GET', '/efforts/Not%20A%20Slug')).toMatchObject(notFound);

    const names = async (query: string) => (await alice.json('GET', `/efforts${query}`)).body.items.map((item: { name: string }) => item.name);
    expect(await names('')).toEqual(['tracker', 'adapter']);
    expect(await names('?sort=name&order=desc')).toEqual(['tracker', 'adapter']);
    expect(await names('?sort=updatedAt')).toEqual(['tracker', 'adapter']);
    expect(await names('?sort=name')).toEqual(['adapter', 'tracker']);
    await alice.json('PATCH', `/issues/${adapter.number}`, { body: { title: 'Adapter renamed' } });
    expect(await names('?sort=updatedAt&order=desc')).toEqual(['adapter', 'tracker']);
    expect(await alice.json('GET', '/efforts?sort=title')).toMatchObject(invalidOn('sort'));

    const first = (await alice.json('GET', '/efforts?limit=1')).body;
    expect(first.items.map((item: { name: string }) => item.name)).toEqual(['tracker']);
    expect(first.items[0]).toHaveProperty('statusRollup');
    const second = (await alice.json('GET', `/efforts?limit=1&cursor=${first.nextCursor}`)).body;
    expect(second).toMatchObject({ items: [{ name: 'adapter' }], nextCursor: null });
  });

  it('rolls Links up through the parent chain: deduped by URL with both sources, closed tickets included, grouped by role; artifacts.md lists the Artifacts', async () => {
    const { effort, map } = await chart('rollup');
    const spec = await create('spec', 'Spec', { parent: effort.number });
    const ticket = await create('ticket', 'T', { parent: spec.number });
    const floating = await create('ticket', 'Floating');
    await addLink(alice, effort.number, { role: 'resource', type: 'doc', url: 'https://figma.example/x', title: 'Brief' });
    await addLink(alice, map.number, { role: 'resource', type: 'doc', url: 'https://figma.example/x', title: 'Brief again' });
    await addLink(alice, ticket.number, { role: 'artifact', type: 'branch', url: 'https://git.example/tree/prototype/auth', title: 'Auth prototype' });
    const { body: preview } = await addLink(alice, ticket.number, { role: 'artifact', type: 'preview', url: 'https://pr-12.example', title: 'Preview' });
    await addLink(alice, floating.number, { role: 'artifact', type: 'branch', url: 'https://git.example/tree/elsewhere', title: 'Elsewhere' });
    await alice.json('POST', `/issues/${ticket.number}/close`);

    const rollup = (await alice.json('GET', '/efforts/rollup')).body.linkRollup;
    expect(rollup.resource).toEqual([{ url: 'https://figma.example/x', title: 'Brief', type: 'doc', sources: [effort.number, map.number] }]);
    expect(rollup.artifact).toEqual([
      { url: 'https://git.example/tree/prototype/auth', title: 'Auth prototype', type: 'branch', sources: [ticket.number] },
      { url: 'https://pr-12.example', title: 'Preview', type: 'preview', sources: [ticket.number] },
    ]);

    const markdown = await alice.request('GET', `/efforts/${effort.number}/artifacts.md`);
    expect(markdown.status).toBe(200);
    expect(markdown.headers.get('content-type')).toMatch(/^text\/markdown/);
    expect(await markdown.text()).toBe('- [Auth prototype](https://git.example/tree/prototype/auth)\n- [Preview](https://pr-12.example)\n');

    await alice.json('DELETE', `/issues/${ticket.number}/links/${preview.id}`);
    expect((await alice.json('GET', '/efforts/rollup')).body.linkRollup.artifact).toHaveLength(1);
    expect(await (await alice.request('GET', `/efforts/${floating.number}/artifacts.md`)).json()).toMatchObject({ error: { code: 'invalid', field: 'handle' } });
    expect((await alice.request('GET', '/efforts/no-such/artifacts.md')).status).toBe(404);
  });

  it('computes the status roll-up: map Frontier, per-spec counts by status, triage buckets for Effort-parented tickets only, open total', async () => {
    const { effort, map } = await chart('status');
    const a = await create('ticket', 'A', { parent: map.number });
    await create('ticket', 'B', { parent: map.number, blockedBy: [a.number] });
    const spec = await create('spec', 'Spec', { parent: effort.number });
    const s1 = await create('ticket', 'S1', { parent: spec.number });
    await create('ticket', 'S2', { parent: spec.number, blockedBy: [s1.number] });
    const s3 = await create('ticket', 'S3', { parent: spec.number });
    await alice.json('POST', `/issues/${s1.number}/claim`);
    const bug = await create('ticket', 'bug', { parent: effort.number, labels: ['needs-triage'] });
    await create('ticket', 'bug2', { parent: effort.number });
    await create('ticket', 'floating', { labels: ['needs-triage'] });

    const rollup = async () => (await alice.json('GET', '/efforts/status')).body.statusRollup;
    expect(await rollup()).toEqual({
      map: { state: 'open', frontier: 1 },
      specs: [{ number: spec.number, tickets: { open: 1, claimed: 1, blocked: 1, closed: 0 } }],
      triage: { 'needs-triage': 1, 'needs-info': 0, 'ready-for-agent': 0, 'ready-for-human': 0, 'wontfix': 0, 'none': 1 },
      open: 9,
    });

    await alice.json('POST', `/issues/${a.number}/close`);
    await alice.json('POST', `/issues/${s3.number}/close`);
    await alice.json('PUT', `/issues/${bug.number}/labels/wontfix`);
    expect(await rollup()).toMatchObject({ map: { state: 'open', frontier: 1 }, specs: [{ tickets: { open: 0, claimed: 1, blocked: 1, closed: 1 } }], triage: { 'needs-triage': 0, 'wontfix': 1, 'none': 1 }, open: 7 });
    expect((await alice.json('GET', '/efforts?sort=name')).body.items.find((item: { name: string }) => item.name === 'status').statusRollup.open).toBe(7);

    await alice.json('POST', `/issues/${map.number}/close`);
    expect((await rollup()).map).toEqual({ state: 'closed', frontier: 1 });
  });
});
