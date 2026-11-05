import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';

const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });
const notFound = { status: 404, body: { error: { code: 'not-found' } } };
const forbidden = { status: 403, body: { error: { code: 'forbidden' } } };
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
type Client = ReturnType<typeof apiClient>;
const createTicket = async (client: Client, title: string, extra: Record<string, unknown> = {}) =>
  (await client.json('POST', '/issues', { body: { kind: 'ticket', title, ...extra } })).body;
const changesOf = async (client: Client, number: number, field: string) =>
  (await client.json('GET', `/issues/${number}/changes?field=${field}`)).body.items;
const logged = (items: { field: string, before: string | null, after: string | null }[]) => items.map(({ field, before, after }) => [field, before, after]);

describe('blockers', () => {
  const server = useTestServer();
  let alice: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const ticket = (title: string, extra?: Record<string, unknown>) => createTicket(alice, title, extra);

  it('charts a map and wires blocking in a second pass: both sides visible, status blocked, closing a blocker flips open and status', async () => {
    const effort = (await alice.json('POST', '/issues', { body: { kind: 'effort', title: 'Tracker', name: 'tracker' } })).body;
    const map = (await alice.json('POST', '/issues', { body: { kind: 'map', title: 'Map', parent: effort.number } })).body;
    const a = await ticket('A', { parent: map.number });
    const b = await ticket('B', { parent: map.number });
    const c = await ticket('C', { parent: map.number });

    expect(await alice.json('PUT', `/issues/${c.number}/blockers/${a.number}`)).toMatchObject({ status: 204 });
    expect(await alice.json('PUT', `/issues/${c.number}/blockers/${b.number}`)).toMatchObject({ status: 204 });

    const blocked = (await alice.json('GET', `/issues/${c.number}`)).body;
    expect(blocked).toMatchObject({ status: 'blocked', state: 'open', version: 1 });
    expect(blocked.blockedBy).toEqual([{ number: a.number, title: 'A', open: true }, { number: b.number, title: 'B', open: true }]);
    expect((await alice.json('GET', `/issues/${a.number}`)).body).toMatchObject({ blocks: [{ number: c.number, title: 'C' }], blockedBy: [], status: 'open' });
    const rows = (await alice.json('GET', `/issues?numbers=${a.number},${c.number}`)).body.items;
    expect(rows[0]).toMatchObject({ number: a.number, blockedBy: [] });
    expect(rows[1]).toMatchObject({ number: c.number, status: 'blocked', blockedBy: [{ number: a.number, open: true }, { number: b.number, open: true }] });
    expect(rows[1].blockedBy[0]).not.toHaveProperty('title');

    await alice.json('POST', `/issues/${a.number}/close`);
    const halfway = (await alice.json('GET', `/issues/${c.number}`)).body;
    expect(halfway.status).toBe('blocked');
    expect(halfway.blockedBy).toEqual([{ number: a.number, title: 'A', open: false }, { number: b.number, title: 'B', open: true }]);

    await alice.json('POST', `/issues/${b.number}/close`);
    expect((await alice.json('GET', `/issues/${c.number}`)).body.status).toBe('open');
    await alice.json('POST', `/issues/${c.number}/claim`);
    expect((await alice.json('GET', `/issues/${c.number}`)).body.status).toBe('claimed');
    await alice.json('POST', `/issues/${b.number}/reopen`);
    expect((await alice.json('GET', `/issues/${c.number}`)).body.status).toBe('blocked');
    await alice.json('POST', `/issues/${c.number}/close`);
    expect((await alice.json('GET', `/issues/${c.number}`)).body.status).toBe('closed');
  });

  it('adding an edge twice logs one Change; removing twice is 204 both times and logs once', async () => {
    const a = await ticket('A');
    const b = await ticket('B');

    expect(await alice.json('PUT', `/issues/${b.number}/blockers/${a.number}`)).toMatchObject({ status: 204 });
    expect(await alice.json('PUT', `/issues/${b.number}/blockers/${a.number}`)).toMatchObject({ status: 204 });
    expect(logged(await changesOf(alice, b.number, 'blocker'))).toEqual([['blocker', null, String(a.number)]]);
    expect(await changesOf(alice, a.number, 'blocker')).toEqual([]);

    expect(await alice.json('DELETE', `/issues/${b.number}/blockers/${a.number}`)).toMatchObject({ status: 204 });
    expect(await alice.json('DELETE', `/issues/${b.number}/blockers/${a.number}`)).toMatchObject({ status: 204 });
    expect(await alice.json('DELETE', `/issues/${b.number}/blockers/999999`)).toMatchObject({ status: 204 });
    expect(logged(await changesOf(alice, b.number, 'blocker'))).toEqual([['blocker', null, String(a.number)], ['blocker', String(a.number), null]]);
    expect((await alice.json('GET', `/issues/${b.number}`)).body).toMatchObject({ blockedBy: [], status: 'open' });
    expect((await alice.json('GET', `/issues/${a.number}`)).body.blocks).toEqual([]);
  });

  it('refuses a self-block, a two-step cycle and a longer cycle as invalid; a missing issue on either side is not-found', async () => {
    const a = await ticket('A');
    const b = await ticket('B', { blockedBy: [a.number] });
    const c = await ticket('C', { blockedBy: [b.number] });

    expect(await alice.json('PUT', `/issues/${a.number}/blockers/${a.number}`)).toMatchObject(invalidOn('blocker'));
    expect(await alice.json('PUT', `/issues/${a.number}/blockers/${b.number}`)).toMatchObject(invalidOn('blocker'));
    expect(await alice.json('PUT', `/issues/${a.number}/blockers/${c.number}`)).toMatchObject(invalidOn('blocker'));
    expect(await alice.json('PUT', `/issues/${a.number}/blockers/999999`)).toMatchObject({ ...notFound, body: { error: { message: expect.stringContaining('999999') } } });
    expect(await alice.json('PUT', `/issues/999999/blockers/${a.number}`)).toMatchObject(notFound);
    expect(await alice.json('PUT', `/issues/${a.number}/blockers/abc`)).toMatchObject(notFound);
    expect(await alice.json('DELETE', `/issues/999999/blockers/${a.number}`)).toMatchObject(notFound);
    expect(await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'D', blockedBy: [999999] } })).toMatchObject({ ...notFound, body: { error: { message: expect.stringContaining('999999') } } });
    expect((await alice.json('GET', `/issues/${a.number}`)).body.blockedBy).toEqual([]);
  });

  it('deleting a blocker clears the edge and logs a blocker removal naming the deleted issue, attributed to the deleting holder', async () => {
    const bob = apiClient(server, await holderSecret(server, 'bob', 'Bob'));
    const a = await ticket('Gone soon');
    const b = await ticket('B', { blockedBy: [a.number] });
    expect((await alice.json('GET', `/issues/${b.number}`)).body.status).toBe('blocked');
    const before = (await alice.json('GET', `/issues/${b.number}`)).body.updatedAt;

    await sleep(5);
    expect(await bob.json('DELETE', `/issues/${a.number}`)).toMatchObject({ status: 204 });

    const freed = (await alice.json('GET', `/issues/${b.number}`)).body;
    expect(freed).toMatchObject({ blockedBy: [], status: 'open', version: 1 });
    expect(freed.updatedAt > before).toBe(true);
    const removals = await changesOf(alice, b.number, 'blocker');
    expect(removals).toHaveLength(1);
    expect(removals[0]).toMatchObject({ field: 'blocker', after: null, actor: 'bob', origin: 'api' });
    expect(removals[0].before).toContain(String(a.number));
    expect(removals[0].before).toContain('Gone soon');
  });
});

describe('labels', () => {
  const server = useTestServer();
  let alice: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const ticket = (title: string, extra?: Record<string, unknown>) => createTicket(alice, title, extra);

  it('a triage agent adds ready-for-agent and needs-triage disappears in the same write with both Changes logged', async () => {
    const triaged = await ticket('Triage me', { labels: ['needs-triage'] });

    expect(await alice.json('PUT', `/issues/${triaged.number}/labels/ready-for-agent`)).toMatchObject({ status: 204 });

    expect((await alice.json('GET', `/issues/${triaged.number}`)).body.labels).toEqual(['ready-for-agent']);
    expect(logged(await changesOf(alice, triaged.number, 'label'))).toEqual([['label', 'needs-triage', null], ['label', null, 'ready-for-agent']]);
  });

  it('triage: one category and one state survive, free-form labels stay beside them, every add and sibling removal is its own Change', async () => {
    const bug = await ticket('Crash on save');

    for (const label of ['bug', 'needs-triage', 'needs-info', 'enhancement', 'frontend']) {
      expect(await alice.json('PUT', `/issues/${bug.number}/labels/${label}`)).toMatchObject({ status: 204 });
    }

    expect((await alice.json('GET', `/issues/${bug.number}`)).body.labels).toEqual(['enhancement', 'frontend', 'needs-info']);
    expect((await alice.json('GET', `/issues?numbers=${bug.number}`)).body.items[0].labels).toEqual(['enhancement', 'frontend', 'needs-info']);
    expect(logged(await changesOf(alice, bug.number, 'label'))).toEqual([
      ['label', null, 'bug'],
      ['label', null, 'needs-triage'],
      ['label', 'needs-triage', null],
      ['label', null, 'needs-info'],
      ['label', 'bug', null],
      ['label', null, 'enhancement'],
      ['label', null, 'frontend'],
    ]);

    expect(await alice.json('PUT', `/issues/${bug.number}/labels/frontend`)).toMatchObject({ status: 204 });
    expect(await alice.json('PUT', `/issues/${bug.number}/labels/needs-info`)).toMatchObject({ status: 204 });
    expect(await changesOf(alice, bug.number, 'label')).toHaveLength(7);

    expect(await alice.json('DELETE', `/issues/${bug.number}/labels/frontend`)).toMatchObject({ status: 204 });
    expect(await alice.json('DELETE', `/issues/${bug.number}/labels/frontend`)).toMatchObject({ status: 204 });
    expect(await alice.json('DELETE', `/issues/${bug.number}/labels/never-there`)).toMatchObject({ status: 204 });
    expect(logged(await changesOf(alice, bug.number, 'label'))).toHaveLength(8);
    expect((await alice.json('GET', `/issues/${bug.number}`)).body.labels).toEqual(['enhancement', 'needs-info']);
  });

  it('refuses a blank label and a missing issue', async () => {
    const work = await ticket('Labelled');
    expect(await alice.json('PUT', `/issues/${work.number}/labels/%20%20`)).toMatchObject(invalidOn('label'));
    expect(await alice.json('PUT', '/issues/999999/labels/bug')).toMatchObject(notFound);
    expect(await alice.json('DELETE', '/issues/999999/labels/bug')).toMatchObject(notFound);
    expect(await alice.json('PUT', `/issues/${work.number}/labels/${encodeURIComponent('wayfinder:task')}`)).toMatchObject({ status: 204 });
    expect((await alice.json('GET', `/issues/${work.number}`)).body.labels).toEqual(['wayfinder:task']);
  });

  it('POST /issues applies labels with the exclusivity rule and blockedBy; bad shapes are invalid; creation logs nothing', async () => {
    const effort = (await alice.json('POST', '/issues', { body: { kind: 'effort', title: 'Tracker', name: 'tracker' } })).body;
    const spec = (await alice.json('POST', '/issues', { body: { kind: 'spec', title: 'Spec: auth', parent: effort.number, labels: ['ready-for-agent'] } })).body;
    const t1 = await ticket('Token table', { parent: spec.number, labels: ['ready-for-agent'] });
    const t2 = await ticket('Login route', { parent: spec.number, labels: ['ready-for-agent'], blockedBy: [t1.number] });

    expect(spec.labels).toEqual(['ready-for-agent']);
    expect(t2).toMatchObject({ status: 'blocked', labels: ['ready-for-agent'], effort: effort.number, blockedBy: [{ number: t1.number, title: 'Token table', open: true }] });
    expect((await alice.json('GET', `/issues/${t1.number}`)).body.blocks).toEqual([{ number: t2.number, title: 'Login route' }]);
    expect(await changesOf(alice, t2.number, 'label')).toEqual([]);
    expect(await changesOf(alice, t2.number, 'blocker')).toEqual([]);

    const triaged = await ticket('Triaged', { labels: ['needs-triage', 'needs-info', 'frontend'] });
    expect(triaged.labels).toEqual(['frontend', 'needs-info']);

    expect(await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'x', labels: 'bug' } })).toMatchObject(invalidOn('labels'));
    expect(await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'x', labels: ['bug', ' '] } })).toMatchObject(invalidOn('labels'));
    expect(await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'x', labels: [1] } })).toMatchObject(invalidOn('labels'));
    expect(await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'x', blockedBy: t1.number } })).toMatchObject(invalidOn('blockedBy'));
    expect(await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'x', blockedBy: [0] } })).toMatchObject(invalidOn('blockedBy'));
    expect(await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'x', blockedBy: ['1'] } })).toMatchObject(invalidOn('blockedBy'));
  });

  it('GET /labels lists the three seeded groups first, exclusive, members in seeded order with displayLabel defaulting to the id or the triage default', async () => {
    const groups = await alice.json('GET', '/labels');
    expect(groups.status).toBe(200);
    const member = (id: string) => ({ id, displayLabel: id });
    const triageLabels = { 'needs-triage': 'Needs triage', 'needs-info': 'Needs info', 'ready-for-agent': 'Ready for agent', 'ready-for-human': 'Ready for human', 'wontfix': 'Won\'t fix' };
    expect(groups.body.items.slice(0, 3)).toEqual([
      { id: 'triage-category', displayName: 'triage-category', seeded: true, exclusive: true, labels: ['bug', 'enhancement'].map(member) },
      { id: 'triage-state', displayName: 'triage-state', seeded: true, exclusive: true, labels: Object.entries(triageLabels).map(([id, displayLabel]) => ({ id, displayLabel })) },
      { id: 'wayfinder-type', displayName: 'wayfinder-type', seeded: true, exclusive: true, labels: ['wayfinder:research', 'wayfinder:prototype', 'wayfinder:grilling', 'wayfinder:task'].map(member) },
    ]);
    expect(groups.body.items).toHaveLength(3);
  });
});

describe('timestamps and the Viewer wall', () => {
  const server = useTestServer();
  let alice: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const ticket = (title: string, extra?: Record<string, unknown>) => createTicket(alice, title, extra);
  const stampOf = async (number: number) => {
    const { updatedAt, version } = (await alice.json('GET', `/issues/${number}`)).body;
    return { updatedAt, version };
  };

  it('edges and labels bump updatedAt and never version; no-ops bump nothing', async () => {
    const a = await ticket('A');
    const b = await ticket('B');
    const created = await stampOf(b.number);

    await sleep(5);
    await alice.json('PUT', `/issues/${b.number}/blockers/${a.number}`);
    const afterEdge = await stampOf(b.number);
    await sleep(5);
    await alice.json('PUT', `/issues/${b.number}/blockers/${a.number}`);
    expect(await stampOf(b.number)).toEqual(afterEdge);
    await alice.json('PUT', `/issues/${b.number}/labels/bug`);
    const afterLabel = await stampOf(b.number);
    await sleep(5);
    await alice.json('PUT', `/issues/${b.number}/labels/bug`);
    await alice.json('DELETE', `/issues/${b.number}/labels/nope`);
    await alice.json('DELETE', `/issues/${b.number}/blockers/999999`);
    expect(await stampOf(b.number)).toEqual(afterLabel);
    await alice.json('DELETE', `/issues/${b.number}/labels/bug`);
    const afterLabelRemoval = await stampOf(b.number);
    await sleep(5);
    await alice.json('DELETE', `/issues/${b.number}/blockers/${a.number}`);
    const afterEdgeRemoval = await stampOf(b.number);

    expect(afterEdge.updatedAt > created.updatedAt).toBe(true);
    expect(afterLabel.updatedAt > afterEdge.updatedAt).toBe(true);
    expect(afterLabelRemoval.updatedAt > afterLabel.updatedAt).toBe(true);
    expect(afterEdgeRemoval.updatedAt > afterLabelRemoval.updatedAt).toBe(true);
    expect([created, afterEdge, afterLabel, afterLabelRemoval, afterEdgeRemoval].map(stamp => stamp.version)).toEqual([1, 1, 1, 1, 1]);
    expect(await stampOf(a.number)).toEqual({ updatedAt: a.updatedAt, version: 1 });
  });

  it('a Viewer session is forbidden on every edge and label write and reads /labels', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const a = await ticket('A');
    const b = await ticket('B');

    expect(await viewer.json('PUT', `/issues/${b.number}/blockers/${a.number}`)).toMatchObject(forbidden);
    expect(await viewer.json('DELETE', `/issues/${b.number}/blockers/${a.number}`)).toMatchObject(forbidden);
    expect(await viewer.json('PUT', `/issues/${b.number}/labels/bug`)).toMatchObject(forbidden);
    expect(await viewer.json('DELETE', `/issues/${b.number}/labels/bug`)).toMatchObject(forbidden);
    const groups = await viewer.json('GET', '/labels');
    expect(groups.status).toBe(200);
    expect(groups.body.items.map((group: { id: string }) => group.id)).toEqual(['triage-category', 'triage-state', 'wayfinder-type']);
  });
});
