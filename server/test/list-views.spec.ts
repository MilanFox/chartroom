import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';

type Client = ReturnType<typeof apiClient>;
type Row = { number: number };

const numbersOf = (rows: Row[]) => rows.map(row => row.number);

describe('the Frontier', () => {
  const server = useTestServer();
  let alice: Client;
  let bob: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
    bob = apiClient(server, await holderSecret(server, 'bob', 'Bob'));
  });

  const create = async (client: Client, body: Record<string, unknown>) => (await client.json('POST', '/issues', { body })).body as Row;
  const listed = async (query: string) => numbersOf((await alice.json('GET', `/issues${query}`)).body.items);

  it('wayfinder takes the next decision: open, unclaimed, unblocked children of the map in number order', async () => {
    const effort = await create(alice, { kind: 'effort', title: 'Tracker', name: 'tracker' });
    const map = await create(alice, { kind: 'map', title: 'Map', parent: effort.number });
    const a = await create(alice, { kind: 'ticket', title: 'A', parent: map.number, labels: ['wayfinder:grilling'] });
    const b = await create(alice, { kind: 'ticket', title: 'B', parent: map.number, labels: ['wayfinder:research'] });
    const c = await create(alice, { kind: 'ticket', title: 'C', parent: map.number, labels: ['wayfinder:prototype'] });
    const d = await create(alice, { kind: 'ticket', title: 'D', parent: map.number });
    await alice.json('PUT', `/issues/${c.number}/blockers/${a.number}`);
    await alice.json('PUT', `/issues/${c.number}/blockers/${b.number}`);

    expect(await listed(`?view=frontier&parent=${map.number}`)).toEqual([a.number, b.number, d.number]);

    await bob.json('POST', `/issues/${b.number}/claim`);
    await alice.json('PUT', `/issues/${d.number}/blockers/${b.number}`);
    expect(await listed(`?view=frontier&parent=${map.number}`)).toEqual([a.number]);

    await alice.json('POST', `/issues/${a.number}/close`);
    expect(await listed(`?view=frontier&parent=${map.number}`)).toEqual([]);

    await bob.json('POST', `/issues/${b.number}/close`);
    expect(await listed(`?view=frontier&parent=${map.number}`)).toEqual([c.number, d.number]);
  });

  it('spans every map in number order and leaves out spec, Effort and floating tickets', async () => {
    const first = await create(alice, { kind: 'effort', title: 'First', name: 'first' });
    const second = await create(alice, { kind: 'effort', title: 'Second', name: 'second' });
    const firstMap = await create(alice, { kind: 'map', title: 'First map', parent: first.number });
    const secondMap = await create(alice, { kind: 'map', title: 'Second map', parent: second.number });
    const spec = await create(alice, { kind: 'spec', title: 'Spec', parent: first.number });
    const underSecond = await create(alice, { kind: 'ticket', title: 'Under second', parent: secondMap.number });
    const underSpec = await create(alice, { kind: 'ticket', title: 'Under spec', parent: spec.number });
    const underEffort = await create(alice, { kind: 'ticket', title: 'Under Effort', parent: first.number });
    const floating = await create(alice, { kind: 'ticket', title: 'Floating' });
    const underFirst = await create(alice, { kind: 'ticket', title: 'Under first', parent: firstMap.number });

    const frontier = await listed('?view=frontier');

    expect(frontier).toEqual([...frontier].sort((a, b) => a - b));
    expect(frontier).toEqual(expect.arrayContaining([underSecond.number, underFirst.number]));
    expect(frontier).not.toContain(underSpec.number);
    expect(frontier).not.toContain(underEffort.number);
    expect(frontier).not.toContain(floating.number);
    expect(frontier).not.toContain(firstMap.number);
    expect(await listed('?view=frontier&effort=first')).toEqual([underFirst.number]);
  });
});

describe('the triage queue', () => {
  const server = useTestServer();
  let triager: Client;

  beforeAll(async () => {
    triager = apiClient(server, await holderSecret(server, 'triager', 'Triager'));
  });

  const ticket = async (title: string, extra: Record<string, unknown> = {}) =>
    (await triager.json('POST', '/issues', { body: { kind: 'ticket', title, ...extra } })).body as Row;
  const listed = async (query: string) => numbersOf((await triager.json('GET', `/issues${query}`)).body.items);
  const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

  it('triage walks untriaged issues oldest first, and needs-triage moves one into its own view', async () => {
    const oldest = await ticket('Oldest');
    await sleep(5);
    const middle = await ticket('Middle', { labels: ['bug'] });
    await sleep(5);
    const newest = await ticket('Newest');
    await ticket('Triaged', { labels: ['ready-for-agent'] });
    const closed = await ticket('Closed');
    await triager.json('POST', `/issues/${closed.number}/close`);
    await sleep(5);
    await triager.json('PATCH', `/issues/${oldest.number}`, { body: { body: 'touched last' } });

    expect(await listed('?missing=triage-state&state=open&sort=createdAt')).toEqual([oldest.number, middle.number, newest.number]);
    expect(await listed('?view=needs-triage&sort=createdAt')).toEqual([]);

    await triager.json('PUT', `/issues/${newest.number}/labels/needs-triage`);
    await triager.json('PUT', `/issues/${oldest.number}/labels/needs-triage`);

    expect(await listed('?missing=triage-state&state=open&sort=createdAt')).toEqual([middle.number]);
    expect(await listed('?view=needs-triage&sort=createdAt')).toEqual([oldest.number, newest.number]);

    await triager.json('POST', `/issues/${oldest.number}/close`);
    expect(await listed('?view=needs-triage&sort=createdAt')).toEqual([newest.number]);
  });

  it('triage finds needs-info issues with reporter activity, oldest first; the triage agent\'s own comments do not count', async () => {
    const reporter = apiClient(server, await holderSecret(server, 'reporter', 'Reporter'));
    const report = async (title: string) =>
      (await reporter.json('POST', '/issues', { body: { kind: 'ticket', title, labels: ['needs-info'] } })).body as Row;
    const comment = (client: Client, issue: Row, body: string) => client.json('POST', `/issues/${issue.number}/comments`, { body: { body } });
    const withReporterActivity = async () => {
      const waiting = numbersOf((await triager.json('GET', '/issues?label=needs-info&state=open&sort=createdAt')).body.items);
      const documents = await Promise.all(waiting.map(async number => (await triager.json('GET', `/issues/${number}`)).body));
      return documents.filter(document => document.comments.at(-1)?.author === document.createdBy).map(document => document.title);
    };
    const older = await report('older');
    await sleep(5);
    const newer = await report('newer');
    await comment(triager, older, '> *This was generated by AI during triage.*\n\n## Triage Notes\nwhich browser?');
    await comment(triager, newer, '> *This was generated by AI during triage.*\n\n## Triage Notes\nwhich OS?');

    expect(await withReporterActivity()).toEqual([]);

    await comment(reporter, newer, 'macOS');
    await comment(reporter, older, 'Firefox');
    expect(await withReporterActivity()).toEqual(['older', 'newer']);

    await comment(triager, newer, 'Thanks, which version?');
    expect(await withReporterActivity()).toEqual(['older']);

    await triager.json('POST', `/issues/${older.number}/close`, { body: { comment: 'wontfix: duplicate' } });
    expect(await withReporterActivity()).toEqual([]);
  });
});

describe('list filters', () => {
  const server = useTestServer();
  let alice: Client;
  let bob: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
    bob = apiClient(server, await holderSecret(server, 'bob', 'Bob'));
  });

  const create = async (body: Record<string, unknown>) => (await alice.json('POST', '/issues', { body })).body as Row;
  const listed = async (query: string) => numbersOf((await alice.json('GET', `/issues${query}`)).body.items);

  it('a developer narrows the list by two labels: both must be carried, group members and free-form alike', async () => {
    const effort = await create({ kind: 'effort', title: 'Labels', name: 'labels' });
    const frontendBug = await create({ kind: 'ticket', title: 'Frontend bug', parent: effort.number, labels: ['bug', 'frontend'] });
    const backendBug = await create({ kind: 'ticket', title: 'Backend bug', parent: effort.number, labels: ['bug', 'backend'] });
    const frontendIdea = await create({ kind: 'ticket', title: 'Frontend idea', parent: effort.number, labels: ['enhancement', 'frontend'] });

    expect(await listed('?effort=labels&label=bug')).toEqual([frontendBug.number, backendBug.number]);
    expect(await listed('?effort=labels&label=frontend')).toEqual([frontendBug.number, frontendIdea.number]);
    expect(await listed('?effort=labels&label=bug&label=frontend')).toEqual([frontendBug.number]);
    expect(await listed('?effort=labels&label=bug&label=enhancement')).toEqual([]);
    expect(await listed('?effort=labels&label=nobody-uses-this')).toEqual([]);
  });

  it('a developer filters by who holds an issue: a holder slug, or none for unclaimed', async () => {
    const effort = await create({ kind: 'effort', title: 'Assignees', name: 'assignees' });
    const mine = await create({ kind: 'ticket', title: 'Alice holds', parent: effort.number });
    const theirs = await create({ kind: 'ticket', title: 'Bob holds', parent: effort.number });
    const nobodys = await create({ kind: 'ticket', title: 'Nobody holds', parent: effort.number });
    await alice.json('POST', `/issues/${mine.number}/claim`);
    await bob.json('POST', `/issues/${theirs.number}/claim`);

    expect(await listed('?effort=assignees&assignee=alice')).toEqual([mine.number]);
    expect(await listed('?effort=assignees&assignee=bob')).toEqual([theirs.number]);
    expect(await listed('?effort=assignees&assignee=none&kind=ticket')).toEqual([nobodys.number]);
  });

  it('a developer opens My stuff: open issues the caller holds, narrowed by kind', async () => {
    const carol = apiClient(server, await holderSecret(server, 'carol', 'Carol'));
    const effort = (await carol.json('POST', '/issues', { body: { kind: 'effort', title: 'Carol effort', name: 'carol-effort' } })).body as Row;
    const held = (await carol.json('POST', '/issues', { body: { kind: 'ticket', title: 'Held', parent: effort.number } })).body as Row;
    const done = (await carol.json('POST', '/issues', { body: { kind: 'ticket', title: 'Done', parent: effort.number } })).body as Row;
    const elsewhere = await create({ kind: 'ticket', title: 'Bob holds' });
    await carol.json('POST', `/issues/${effort.number}/claim`);
    await carol.json('POST', `/issues/${held.number}/claim`);
    await carol.json('POST', `/issues/${done.number}/claim`);
    await carol.json('POST', `/issues/${done.number}/close`);
    await bob.json('POST', `/issues/${elsewhere.number}/claim`);

    expect(numbersOf((await carol.json('GET', '/issues?view=mine')).body.items)).toEqual([effort.number, held.number]);
    expect(numbersOf((await carol.json('GET', '/issues?view=mine&kind=ticket')).body.items)).toEqual([held.number]);
  });

  it('a Viewer has no holder, so My stuff is invalid for it', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(await viewer.json('GET', '/issues?view=mine')).toMatchObject({ status: 400, body: { error: { code: 'invalid', field: 'view' } } });
  });

  it('a developer opens Blocked: open issues with an open blocker, narrowed by kind', async () => {
    const effort = await create({ kind: 'effort', title: 'Blocked', name: 'blocked' });
    const map = await create({ kind: 'map', title: 'Blocked map', parent: effort.number });
    const blocker = await create({ kind: 'ticket', title: 'Blocker', parent: map.number });
    const doneBlocker = await create({ kind: 'ticket', title: 'Done blocker', parent: map.number });
    const blocked = await create({ kind: 'ticket', title: 'Blocked', parent: map.number, blockedBy: [blocker.number] });
    const unblocked = await create({ kind: 'ticket', title: 'Unblocked', parent: map.number, blockedBy: [doneBlocker.number] });
    const closedBlocked = await create({ kind: 'ticket', title: 'Closed but blocked', parent: map.number, blockedBy: [blocker.number] });
    await alice.json('PUT', `/issues/${map.number}/blockers/${blocker.number}`);
    await alice.json('POST', `/issues/${doneBlocker.number}/close`);
    await alice.json('POST', `/issues/${closedBlocked.number}/close`);

    expect(await listed('?view=blocked&effort=blocked')).toEqual([map.number, blocked.number]);
    expect(await listed('?view=blocked&effort=blocked&kind=ticket')).toEqual([blocked.number]);
    expect(await listed('?view=blocked&effort=blocked')).not.toContain(unblocked.number);
  });

  it('a developer opens Recently closed: closed issues only, narrowed by kind', async () => {
    const effort = await create({ kind: 'effort', title: 'Recent', name: 'recent' });
    const spec = await create({ kind: 'spec', title: 'Recent spec', parent: effort.number });
    const closedTicket = await create({ kind: 'ticket', title: 'Closed ticket', parent: spec.number });
    await create({ kind: 'ticket', title: 'Open ticket', parent: spec.number });
    const reopened = await create({ kind: 'ticket', title: 'Reopened', parent: spec.number });
    await alice.json('POST', `/issues/${closedTicket.number}/close`);
    await alice.json('POST', `/issues/${spec.number}/close`);
    await alice.json('POST', `/issues/${reopened.number}/close`);
    await alice.json('POST', `/issues/${reopened.number}/reopen`);

    expect(await listed('?view=closed-recent&effort=recent')).toEqual([spec.number, closedTicket.number]);
    expect(await listed('?view=closed-recent&effort=recent&kind=ticket')).toEqual([closedTicket.number]);
  });
});

describe('list validation', () => {
  const server = useTestServer();
  let alice: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });
  const list = (query: string) => alice.json('GET', `/issues${query}`);

  it('refuses an unknown view, assignee, group id or sort key and a blank label with the field named', async () => {
    expect(await list('?view=everything')).toMatchObject(invalidOn('view'));
    expect(await list('?view=frontier&view=mine')).toMatchObject(invalidOn('view'));
    expect(await list('?assignee=ghost')).toMatchObject(invalidOn('assignee'));
    expect(await list('?missing=priority')).toMatchObject(invalidOn('missing'));
    expect(await list('?missing=bug')).toMatchObject(invalidOn('missing'));
    expect(await list('?sort=priority')).toMatchObject(invalidOn('sort'));
    expect(await list('?sort=needs-triage')).toMatchObject(invalidOn('sort'));
    expect(await list('?label=bug&label=%20')).toMatchObject(invalidOn('label'));
  });

  it('a developer combines a Saved view with every filter and a group sort, including a label nobody carries', async () => {
    expect(await list('?assignee=alice&missing=triage-state&sort=triage-state&view=mine&label=anything')).toMatchObject({ status: 200, body: { items: [], nextCursor: null } });
  });
});

describe('group sort', () => {
  const server = useTestServer();
  let alice: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const create = async (body: Record<string, unknown>) => (await alice.json('POST', '/issues', { body })).body as Row;
  const list = (query: string) => alice.json('GET', `/issues${query}`);
  const walk = async (query: string, limit: number) => {
    const walked: number[] = [];
    let cursor: string | null = null;
    do {
      const page = await list(`${query}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`);
      expect(page.status).toBe(200);
      walked.push(...numbersOf(page.body.items));
      cursor = page.body.nextCursor;
    } while (cursor);
    return walked;
  };

  it('sort by a Label group follows member order, unlabelled last, and pages across the boundary in both orders', async () => {
    const effort = await create({ kind: 'effort', title: 'Sorting', name: 'sorting' });
    const ticket = (title: string, labels: string[] = []) => create({ kind: 'ticket', title, parent: effort.number, labels });
    const agentReady = await ticket('Agent ready', ['ready-for-agent']);
    const firstBare = await ticket('First bare', ['frontend']);
    const firstUntriaged = await ticket('First untriaged', ['needs-triage']);
    const refused = await ticket('Refused', ['wontfix', 'bug']);
    const secondBare = await ticket('Second bare');
    const secondUntriaged = await ticket('Second untriaged', ['needs-triage']);
    const waiting = await ticket('Waiting', ['needs-info']);

    const ascending = [firstUntriaged, secondUntriaged, waiting, agentReady, refused, firstBare, secondBare].map(row => row.number);
    const descending = [refused, agentReady, waiting, secondUntriaged, firstUntriaged, secondBare, firstBare].map(row => row.number);

    for (const limit of [1, 2, 3, 50]) {
      expect(await walk('?effort=sorting&kind=ticket&sort=triage-state', limit), `asc by ${limit}`).toEqual(ascending);
      expect(await walk('?effort=sorting&kind=ticket&sort=triage-state&order=desc', limit), `desc by ${limit}`).toEqual(descending);
    }
  });

  it('wayfinder sorts its tickets by wayfinder-type: any group sorts, and its cursor only pages that sort', async () => {
    const effort = await create({ kind: 'effort', title: 'Wayfinding', name: 'wayfinding' });
    const ticket = (title: string, labels: string[] = []) => create({ kind: 'ticket', title, parent: effort.number, labels });
    const task = await ticket('Task', ['wayfinder:task']);
    const research = await ticket('Research', ['wayfinder:research', 'needs-triage']);
    const bare = await ticket('Bare');

    const page = await list('?effort=wayfinding&kind=ticket&sort=wayfinder-type&limit=2');

    expect(numbersOf(page.body.items)).toEqual([research.number, task.number]);
    expect(numbersOf((await list(`?effort=wayfinding&kind=ticket&sort=wayfinder-type&limit=2&cursor=${page.body.nextCursor}`)).body.items)).toEqual([bare.number]);
    expect(await list(`?effort=wayfinding&kind=ticket&sort=triage-state&cursor=${page.body.nextCursor}`)).toMatchObject({ status: 400, body: { error: { code: 'invalid', field: 'cursor' } } });
    expect(await list(`?effort=wayfinding&kind=ticket&sort=number&cursor=${page.body.nextCursor}`)).toMatchObject({ status: 400, body: { error: { code: 'invalid', field: 'cursor' } } });
  });
});
