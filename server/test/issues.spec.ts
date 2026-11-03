import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';

const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

describe('issue core', () => {
  const server = useTestServer();
  let api: ReturnType<typeof apiClient>;

  beforeAll(async () => {
    api = apiClient(server, await holderSecret(server, 'agent', 'Agent'));
  });

  const create = (body: Record<string, unknown>) => api.json('POST', '/issues', { body });
  const effort = async (name: string) => (await create({ kind: 'effort', title: `Effort ${name}`, name })).body;

  it('creates an Effort, a map and a spec under it, a ticket under each and a floating ticket', async () => {
    const tracker = await create({ kind: 'effort', title: 'Tracker', name: 'tracker', body: '# Tracker', testInstructions: 'run it' });

    expect(tracker.status).toBe(201);
    expect(tracker.body).toEqual({
      number: expect.any(Number),
      kind: 'effort',
      title: 'Tracker',
      state: 'open',
      status: 'open',
      assignee: null,
      parent: null,
      effort: null,
      labels: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      url: `${server.baseUrl}/issues/${tracker.body.number}`,
      body: '# Tracker',
      createdBy: 'agent',
      origin: 'api',
      closedAt: null,
      version: 1,
      blockedBy: [],
      blocks: [],
      children: [],
      links: [],
      comments: [],
      resolution: null,
      name: 'tracker',
      testInstructions: 'run it',
    });

    const map = await create({ kind: 'map', title: 'Map', parent: tracker.body.number });
    const spec = await create({ kind: 'spec', title: 'Spec', parent: tracker.body.number });
    const underMap = await create({ kind: 'ticket', title: 'A', parent: map.body.number });
    const underSpec = await create({ kind: 'ticket', title: 'B', parent: spec.body.number });
    const underEffort = await create({ kind: 'ticket', title: 'C', parent: tracker.body.number });
    const floating = await create({ kind: 'ticket', title: 'D' });

    for (const created of [map, spec, underMap, underSpec, underEffort, floating]) expect(created.status).toBe(201);
    expect(map.body).toMatchObject({ kind: 'map', parent: tracker.body.number, effort: tracker.body.number });
    expect(map.body.name).toBeUndefined();
    expect(underMap.body).toMatchObject({ parent: map.body.number, effort: tracker.body.number });
    expect(underSpec.body).toMatchObject({ parent: spec.body.number, effort: tracker.body.number });
    expect(underEffort.body).toMatchObject({ parent: tracker.body.number, effort: tracker.body.number });
    expect(floating.body).toMatchObject({ parent: null, effort: null, body: '' });

    const document = await api.json('GET', `/issues/${tracker.body.number}`);
    expect(document.status).toBe(200);
    expect(document.body).toEqual({ ...tracker.body, children: [map.body.number, spec.body.number, underEffort.body.number] });
  });

  it('is not-found for an unknown or non-numeric number', async () => {
    expect(await api.json('GET', '/issues/999999')).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(await api.json('GET', '/issues/abc')).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
  });

  it('refuses a second map, a map or spec without an Effort, a parent on an Effort and name on a non-Effort', async () => {
    const tracker = await effort('rules');
    const map = await create({ kind: 'map', title: 'first', parent: tracker.number });

    expect(await create({ kind: 'map', title: 'second', parent: tracker.number })).toMatchObject({ status: 409, body: { error: { code: 'conflict', message: expect.stringContaining(`#${map.body.number}`) } } });
    expect(await create({ kind: 'map', title: 'orphan' })).toMatchObject(invalidOn('parent'));
    expect(await create({ kind: 'spec', title: 'orphan' })).toMatchObject(invalidOn('parent'));
    expect(await create({ kind: 'spec', title: 'under map', parent: map.body.number })).toMatchObject(invalidOn('parent'));
    expect(await create({ kind: 'effort', title: 'child', name: 'child', parent: tracker.number })).toMatchObject(invalidOn('parent'));
    expect(await create({ kind: 'ticket', title: 'named', name: 'named' })).toMatchObject(invalidOn('name'));
    expect(await create({ kind: 'ticket', title: 'tested', testInstructions: 'x' })).toMatchObject(invalidOn('testInstructions'));
    expect(await create({ kind: 'ticket', title: 'x', parent: 999999 })).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(await create({ kind: 'story', title: 'x' })).toMatchObject(invalidOn('kind'));
    expect(await create({ kind: 'ticket' })).toMatchObject(invalidOn('title'));
    expect(await create({ kind: 'ticket', title: 'x', parent: 'nope' })).toMatchObject(invalidOn('parent'));
  });

  it('a taken Effort name is conflict naming the existing Effort; a bad shape is invalid', async () => {
    const existing = await effort('taken');

    const duplicate = await create({ kind: 'effort', title: 'dup', name: 'taken' });
    const shape = await create({ kind: 'effort', title: 'bad', name: 'Not A Slug' });

    expect(duplicate).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'name', message: `name taken is taken by #${existing.number}` } } });
    expect(shape).toMatchObject(invalidOn('name'));
  });

  it('allows creating under a closed parent at the model level', async () => {
    const tracker = await effort('closed-parent');
    expect((await create({ kind: 'ticket', title: 'x', parent: tracker.number })).status).toBe(201);
  });

  it('a Viewer session cannot write through /ui', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const refused = await viewer.json('POST', '/issues', { body: { kind: 'ticket', title: 'nope' } });

    expect(refused).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
  });

  it('re-parents a floating ticket onto an Effort, a map and back; effort follows the chain', async () => {
    const tracker = await effort('float');
    const map = (await create({ kind: 'map', title: 'Map', parent: tracker.number })).body;
    const bug = (await create({ kind: 'ticket', title: 'Login broken' })).body;
    const patch = (number: number, body: Record<string, unknown>) => api.json('PATCH', `/issues/${number}`, { body });

    const ontoEffort = await patch(bug.number, { parent: tracker.number });
    const ontoMap = await patch(bug.number, { parent: map.number });
    const back = await patch(bug.number, { parent: null });

    expect(ontoEffort.status).toBe(200);
    expect(ontoEffort.body).toMatchObject({ parent: tracker.number, effort: tracker.number, version: 2 });
    expect(ontoMap.body).toMatchObject({ parent: map.number, effort: tracker.number, version: 3 });
    expect(back.body).toMatchObject({ parent: null, effort: null, version: 4 });
    expect(await patch(map.number, { parent: null })).toMatchObject(invalidOn('parent'));
    expect(await patch(map.number, { parent: bug.number })).toMatchObject(invalidOn('parent'));
    expect(await patch(tracker.number, { parent: map.number })).toMatchObject(invalidOn('parent'));
    expect(await patch(bug.number, { parent: 999999 })).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(await patch(bug.number, { name: 'nope' })).toMatchObject(invalidOn('name'));
    expect(await patch(999999, { title: 'x' })).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect((await api.json('GET', `/issues/${map.number}`)).body.children).toEqual([]);
  });

  it('a second map by re-parenting is conflict; renaming an Effort to a taken name is conflict', async () => {
    const one = await effort('rename-one');
    const two = await effort('rename-two');
    await create({ kind: 'map', title: 'Map one', parent: one.number });
    const mapTwo = (await create({ kind: 'map', title: 'Map two', parent: two.number })).body;

    expect(await api.json('PATCH', `/issues/${mapTwo.number}`, { body: { parent: one.number } })).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'parent' } } });
    expect(await api.json('PATCH', `/issues/${two.number}`, { body: { name: 'rename-one' } })).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'name', message: `name rename-one is taken by #${one.number}` } } });
    expect((await api.json('PATCH', `/issues/${two.number}`, { body: { name: 'rename-three', testInstructions: 'open it' } })).body).toMatchObject({ name: 'rename-three', testInstructions: 'open it', version: 2 });
    expect((await api.json('PATCH', `/issues/${two.number}`, { body: { name: 'rename-two' } })).status).toBe(200);
  });

  it('honours If-Match only when present and names the last writer when stale', async () => {
    const human = uiClient(server);
    await human.login(await holderSecret(server, 'human', 'Human'));
    const bug = (await create({ kind: 'ticket', title: 'One' })).body;

    const stale = await api.json('PATCH', `/issues/${bug.number}`, { body: { title: 'Two' }, headers: { 'if-match': '"5"' } });
    const fresh = await api.json('PATCH', `/issues/${bug.number}`, { body: { title: 'Two' }, headers: { 'if-match': '"1"' } });
    const byHuman = await human.json('PATCH', `/issues/${bug.number}`, { body: { title: 'Three' } });
    const staleAgain = await api.json('PATCH', `/issues/${bug.number}`, { body: { title: 'Four' }, headers: { 'if-match': '2' } });
    const lastWriteWins = await api.json('PATCH', `/issues/${bug.number}`, { body: { title: 'Four' } });

    expect(stale).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'version', message: `issue #${bug.number} is at version 1, last written by agent at ${bug.createdAt}` } } });
    expect(fresh.body).toMatchObject({ title: 'Two', version: 2 });
    expect(byHuman.body).toMatchObject({ title: 'Three', version: 3 });
    expect(staleAgain).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'version', message: expect.stringMatching(/^issue #\d+ is at version 3, last written by human at \d{4}-/) } } });
    expect(lastWriteWins.body).toMatchObject({ title: 'Four', version: 4 });
    expect(await api.json('PATCH', `/issues/${bug.number}`, { body: { title: 'Five' }, headers: { 'if-match': 'abc' } })).toMatchObject(invalidOn('version'));
    expect((await api.json('PATCH', `/issues/${bug.number}`, { body: { title: 'Five' }, headers: { 'if-match': 'W/"4"' } })).body.version).toBe(5);
  });

  it('bumps version on patch and append only, updatedAt on every write, and a no-op patch writes nothing', async () => {
    const note = (await create({ kind: 'ticket', title: 'Note', body: '## Log\n' })).body;

    await sleep(5);
    const patched = (await api.json('PATCH', `/issues/${note.number}`, { body: { title: 'Note!' } })).body;
    await sleep(5);
    const appended = (await api.json('POST', `/issues/${note.number}/body/append`, { body: { section: 'Log', text: 'entry' } })).body;
    await sleep(5);
    const unchanged = (await api.json('PATCH', `/issues/${note.number}`, { body: { title: 'Note!', body: appended.body } })).body;

    expect(note.version).toBe(1);
    expect(patched.version).toBe(2);
    expect(patched.updatedAt > note.updatedAt).toBe(true);
    expect(appended.version).toBe(3);
    expect(appended.updatedAt > patched.updatedAt).toBe(true);
    expect(unchanged).toEqual(appended);
    expect((await api.json('GET', `/issues/${note.number}/changes`)).body.items).toHaveLength(2);
  });

  it('places appended text under the matched heading', async () => {
    const body = '# Title\n\n## Notes\n\nfirst\n\n## Done\n\n- a\n\n### Sub\n\nnested\n\n## Empty\n## Last\n<!-- keep -->\n';
    const appendTo = async (section: string, text: string) => {
      const issue = (await create({ kind: 'ticket', title: 'Append', body })).body;
      return api.json('POST', `/issues/${issue.number}/body/append`, { body: { section, text } });
    };

    expect((await appendTo('Notes', 'second')).body.body).toBe('# Title\n\n## Notes\n\nfirst\nsecond\n\n## Done\n\n- a\n\n### Sub\n\nnested\n\n## Empty\n## Last\n<!-- keep -->\n');
    expect((await appendTo('Done', '- b')).body.body).toBe('# Title\n\n## Notes\n\nfirst\n\n## Done\n\n- a\n\n### Sub\n\nnested\n- b\n\n## Empty\n## Last\n<!-- keep -->\n');
    expect((await appendTo('Sub', 'deeper  \n\n')).body.body).toBe('# Title\n\n## Notes\n\nfirst\n\n## Done\n\n- a\n\n### Sub\n\nnested\ndeeper\n\n## Empty\n## Last\n<!-- keep -->\n');
    expect((await appendTo('Empty', 'filled')).body.body).toBe('# Title\n\n## Notes\n\nfirst\n\n## Done\n\n- a\n\n### Sub\n\nnested\n\n## Empty\nfilled\n## Last\n<!-- keep -->\n');
    expect((await appendTo('Last', 'after comment')).body.body).toBe('# Title\n\n## Notes\n\nfirst\n\n## Done\n\n- a\n\n### Sub\n\nnested\n\n## Empty\n## Last\n<!-- keep -->\nafter comment\n');
    expect((await appendTo('Title', 'at the end')).body.body).toBe('# Title\n\n## Notes\n\nfirst\n\n## Done\n\n- a\n\n### Sub\n\nnested\n\n## Empty\n## Last\n<!-- keep -->\nat the end\n');
    expect(await appendTo('Missing', 'x')).toMatchObject(invalidOn('section'));
    expect(await appendTo('Notes', '')).toMatchObject(invalidOn('text'));

    const twice = (await create({ kind: 'ticket', title: 'Twice', body: '## Notes\none\n## Notes\ntwo' })).body;
    expect((await api.json('POST', `/issues/${twice.number}/body/append`, { body: { section: 'Notes', text: 'x' } })).body.body).toBe('## Notes\none\nx\n## Notes\ntwo');
  });

  it('append ignores If-Match and logs a body Change', async () => {
    const issue = (await create({ kind: 'ticket', title: 'Append', body: '## Log' })).body;

    const appended = await api.json('POST', `/issues/${issue.number}/body/append`, { body: { section: 'Log', text: 'entry' }, headers: { 'if-match': '"99"' } });

    expect(appended.status).toBe(200);
    expect(appended.body).toMatchObject({ body: '## Log\nentry', version: 2 });
    expect((await api.json('GET', `/issues/${issue.number}/changes`)).body.items).toMatchObject([{ field: 'body', before: '## Log', after: '## Log\nentry', actor: 'agent', origin: 'api' }]);
    expect(await api.json('POST', '/issues/999999/body/append', { body: { section: 'Log', text: 'entry' } })).toMatchObject({ status: 404 });
  });

  it('delete with children is conflict carrying the count; without children the issue and its Changes are gone', async () => {
    const tracker = await effort('delete');
    await create({ kind: 'map', title: 'Map', parent: tracker.number });
    const ticket = (await create({ kind: 'ticket', title: 'T', parent: tracker.number })).body;
    await api.json('PATCH', `/issues/${ticket.number}`, { body: { title: 'T2' } });

    const refused = await api.json('DELETE', `/issues/${tracker.number}`);
    expect(refused).toMatchObject({ status: 409, body: { error: { code: 'conflict', message: expect.stringContaining('2 children') } } });
    expect((await api.json('GET', `/issues/${ticket.number}/changes`)).body.items).toHaveLength(1);

    const removed = await api.json('DELETE', `/issues/${ticket.number}`);

    expect(removed).toEqual({ status: 204, body: null });
    expect((await api.json('GET', `/issues/${ticket.number}`)).status).toBe(404);
    expect((await api.json('GET', `/issues/${ticket.number}/changes`)).status).toBe(404);
    expect((await api.json('DELETE', `/issues/${ticket.number}`)).status).toBe(404);
    expect((await api.json('GET', `/issues/${tracker.number}`)).body.children).toHaveLength(1);
  });

  it('logs one Change per written field, pages them and filters by field', async () => {
    const tracker = await effort('log');
    const ticket = (await create({ kind: 'ticket', title: 'A' })).body;
    expect((await api.json('GET', `/issues/${ticket.number}/changes`)).body).toEqual({ items: [], nextCursor: null });

    await api.json('PATCH', `/issues/${ticket.number}`, { body: { title: 'B', body: 'text', parent: tracker.number } });
    await api.json('PATCH', `/issues/${ticket.number}`, { body: { parent: null } });

    const all = await api.json('GET', `/issues/${ticket.number}/changes`);
    expect(all.status).toBe(200);
    expect(all.body.nextCursor).toBeNull();
    expect(all.body.items).toEqual([
      { id: expect.any(Number), issue: ticket.number, actor: 'agent', origin: 'api', at: expect.any(String), field: 'title', before: 'A', after: 'B' },
      { id: expect.any(Number), issue: ticket.number, actor: 'agent', origin: 'api', at: expect.any(String), field: 'body', before: '', after: 'text' },
      { id: expect.any(Number), issue: ticket.number, actor: 'agent', origin: 'api', at: expect.any(String), field: 'parent', before: null, after: String(tracker.number) },
      { id: expect.any(Number), issue: ticket.number, actor: 'agent', origin: 'api', at: expect.any(String), field: 'parent', before: String(tracker.number), after: null },
    ]);
    expect((await api.json('GET', `/issues/${ticket.number}/changes?field=body`)).body.items.map((change: { field: string }) => change.field)).toEqual(['body']);

    const first = await api.json('GET', `/issues/${ticket.number}/changes?limit=3`);
    expect(first.body.items.map((change: { id: number }) => change.id)).toEqual(all.body.items.slice(0, 3).map((change: { id: number }) => change.id));
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await api.json('GET', `/issues/${ticket.number}/changes?limit=3&cursor=${first.body.nextCursor}`);
    expect(second.body).toEqual({ items: [all.body.items[3]], nextCursor: null });
    expect(await api.json('GET', `/issues/${ticket.number}/changes?limit=0`)).toMatchObject(invalidOn('limit'));
    expect(await api.json('GET', `/issues/${ticket.number}/changes?limit=201`)).toMatchObject(invalidOn('limit'));
    expect(await api.json('GET', `/issues/${ticket.number}/changes?cursor=nope`)).toMatchObject(invalidOn('cursor'));
  });

  it('records origin ui through /ui and api through /api/v1', async () => {
    const session = uiClient(server);
    await session.login(await holderSecret(server, 'desk', 'Desk'));

    const viaUi = await session.json('POST', '/issues', { body: { kind: 'ticket', title: 'From the UI' } });
    const viaApi = await create({ kind: 'ticket', title: 'From the API' });
    await api.json('PATCH', `/issues/${viaUi.body.number}`, { body: { title: 'Edited by api' } });
    await session.json('PATCH', `/issues/${viaUi.body.number}`, { body: { title: 'Edited by ui' } });

    expect(viaUi.status).toBe(201);
    expect(viaUi.body).toMatchObject({ origin: 'ui', createdBy: 'desk' });
    expect(viaApi.body).toMatchObject({ origin: 'api', createdBy: 'agent' });
    expect((await session.json('GET', `/issues/${viaUi.body.number}/changes`)).body.items).toMatchObject([
      { actor: 'agent', origin: 'api', field: 'title' },
      { actor: 'desk', origin: 'ui', field: 'title' },
    ]);
  });

  it('continues the number sequence across kinds and after a delete', async () => {
    const tracker = await effort('sequence');
    const ticket = (await create({ kind: 'ticket', title: 'T' })).body;
    await api.json('DELETE', `/issues/${ticket.number}`);
    const next = (await create({ kind: 'map', title: 'M', parent: tracker.number })).body;

    expect(ticket.number).toBe(tracker.number + 1);
    expect(next.number).toBe(ticket.number + 1);
  });
});

type Row = { number: number, title: string, createdAt: string, updatedAt: string, kind: string, parent: number | null };

const SORTS = ['number', 'createdAt', 'updatedAt', 'title'] as const;
const ORDERS = ['asc', 'desc'] as const;

const numbersOf = (rows: Row[]) => rows.map(row => row.number);

const sortedLike = (rows: Row[], sort: typeof SORTS[number], order: typeof ORDERS[number]) => {
  const direction = order === 'asc' ? 1 : -1;
  const compare = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);
  return [...rows].sort((a, b) => (compare(a[sort], b[sort]) || compare(a.number, b.number)) * direction);
};

describe('issue list', () => {
  const server = useTestServer();
  let api: ReturnType<typeof apiClient>;
  let alpha: Row;
  let alphaMap: Row;
  let alphaSpec: Row;
  let underMap: Row;
  let underSpec: Row;
  let underAlpha: Row;
  let beta: Row;
  let underBeta: Row;
  let floating: Row;
  let everything: Row[];

  const create = async (body: Record<string, unknown>) => (await api.json('POST', '/issues', { body })).body as Row;
  const list = (query: string) => api.json('GET', `/issues${query}`);
  const listed = async (query: string) => numbersOf((await list(query)).body.items);

  beforeAll(async () => {
    api = apiClient(server, await holderSecret(server, 'lister', 'Lister'));
    alpha = await create({ kind: 'effort', title: 'Alpha effort', name: 'alpha' });
    alphaMap = await create({ kind: 'map', title: 'Alpha map', parent: alpha.number });
    alphaSpec = await create({ kind: 'spec', title: 'Alpha spec', parent: alpha.number });
    underMap = await create({ kind: 'ticket', title: 'Same', parent: alphaMap.number, body: 'A NEEDLE hides here' });
    underSpec = await create({ kind: 'ticket', title: 'Same', parent: alphaSpec.number });
    underAlpha = await create({ kind: 'ticket', title: 'Same', parent: alpha.number });
    beta = await create({ kind: 'effort', title: 'Beta effort', name: 'beta' });
    underBeta = await create({ kind: 'ticket', title: 'Beta ticket', parent: beta.number, body: '50% done' });
    floating = await create({ kind: 'ticket', title: 'Floating needle' });
    await sleep(5);
    await api.json('PATCH', `/issues/${alphaSpec.number}`, { body: { body: 'touched' } });
    everything = (await list('')).body.items;
  });

  it('lists every issue as Rows in number order by default', async () => {
    const page = await list('');

    expect(page.status).toBe(200);
    expect(page.body.nextCursor).toBeNull();
    expect(numbersOf(page.body.items)).toEqual([alpha, alphaMap, alphaSpec, underMap, underSpec, underAlpha, beta, underBeta, floating].map(row => row.number));
    expect(page.body.items[3]).toEqual({
      number: underMap.number,
      kind: 'ticket',
      title: 'Same',
      state: 'open',
      status: 'open',
      assignee: null,
      parent: alphaMap.number,
      effort: alpha.number,
      labels: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      url: `${server.baseUrl}/issues/${underMap.number}`,
    });
    expect(page.body.items[2].updatedAt > page.body.items[2].createdAt).toBe(true);
  });

  it('pages with a stable cursor under every sort and both orders, ties broken by number', async () => {
    for (const sort of SORTS) {
      for (const order of ORDERS) {
        const walked: Row[] = [];
        let cursor: string | null = null;
        do {
          const page = await list(`?sort=${sort}&order=${order}&limit=2${cursor ? `&cursor=${cursor}` : ''}`);
          expect(page.status).toBe(200);
          expect(page.body.items.length).toBeLessThanOrEqual(2);
          walked.push(...page.body.items);
          cursor = page.body.nextCursor;
        } while (cursor);
        expect(numbersOf(walked), `${sort} ${order}`).toEqual(numbersOf(sortedLike(everything, sort, order)));
      }
    }
  });

  it('filters by kind, state and parent and refuses unknown values', async () => {
    expect(await listed('?kind=map')).toEqual([alphaMap.number]);
    expect(await listed('?kind=effort&order=desc')).toEqual([beta.number, alpha.number]);
    expect(await listed('?state=open')).toEqual(numbersOf(everything));
    expect(await listed('?state=closed')).toEqual([]);
    expect(await listed(`?parent=${alpha.number}`)).toEqual([alphaMap.number, alphaSpec.number, underAlpha.number]);
    expect(await listed(`?parent=${alpha.number}&kind=ticket`)).toEqual([underAlpha.number]);
    expect(await listed('?parent=999999')).toEqual([]);
    expect(await list('?kind=story')).toMatchObject(invalidOn('kind'));
    expect(await list('?state=bogus')).toMatchObject(invalidOn('state'));
    expect(await list('?parent=abc')).toMatchObject(invalidOn('parent'));
  });

  it('effort by slug or number returns the Effort and its whole subtree', async () => {
    const alphaTree = [alpha, alphaMap, alphaSpec, underMap, underSpec, underAlpha].map(row => row.number);

    expect(await listed('?effort=alpha')).toEqual(alphaTree);
    expect(await listed(`?effort=${alpha.number}`)).toEqual(alphaTree);
    expect(await listed('?effort=beta')).toEqual([beta.number, underBeta.number]);
    expect(await listed('?effort=alpha&kind=ticket&sort=title&order=desc')).toEqual([underAlpha.number, underSpec.number, underMap.number]);
    expect(await list('?effort=gamma')).toMatchObject(invalidOn('effort'));
    expect(await list('?effort=999999')).toMatchObject(invalidOn('effort'));
    expect(await list(`?effort=${floating.number}`)).toMatchObject(invalidOn('effort'));
  });

  it('numbers keeps the given order, skips unknown numbers and never pages', async () => {
    const picked = await list(`?numbers=${underBeta.number},${alpha.number},999999,${floating.number}&sort=title`);

    expect(picked.status).toBe(200);
    expect(picked.body.nextCursor).toBeNull();
    expect(numbersOf(picked.body.items)).toEqual([underBeta.number, alpha.number, floating.number]);
    expect(await listed(`?numbers=${underBeta.number},${alpha.number}&kind=effort`)).toEqual([alpha.number]);
    expect(await list(`?numbers=${Array.from({ length: 201 }, (_, index) => index + 1).join(',')}`)).toMatchObject(invalidOn('numbers'));
    expect(await list('?numbers=1,abc')).toMatchObject(invalidOn('numbers'));
    expect(await list('?numbers=')).toMatchObject(invalidOn('numbers'));
  });

  it('q matches title and body case-insensitively as a plain substring', async () => {
    expect(await listed('?q=needle')).toEqual([underMap.number, floating.number]);
    expect(await listed('?q=ALPHA')).toEqual([alpha.number, alphaMap.number, alphaSpec.number]);
    expect(await listed('?q=alpha&kind=spec')).toEqual([alphaSpec.number]);
    expect(await listed('?q=50%25')).toEqual([underBeta.number]);
    expect(await listed('?q=_')).toEqual([]);
    expect(await listed('?q=nowhere')).toEqual([]);
  });

  it('refuses a bad sort, order, limit or cursor with the field', async () => {
    const titlePage = await list('?sort=title&limit=1');

    expect(await list('?sort=body')).toMatchObject(invalidOn('sort'));
    expect(await list('?order=up')).toMatchObject(invalidOn('order'));
    expect(await list('?limit=0')).toMatchObject(invalidOn('limit'));
    expect(await list('?limit=201')).toMatchObject(invalidOn('limit'));
    expect(await list('?limit=two')).toMatchObject(invalidOn('limit'));
    expect(await list('?cursor=nope')).toMatchObject(invalidOn('cursor'));
    expect(await list(`?cursor=${titlePage.body.nextCursor}`)).toMatchObject(invalidOn('cursor'));
  });

  it('a Viewer session reads the same list on /ui/issues', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const page = await viewer.json('GET', '/issues?effort=alpha&limit=2');

    expect(page.status).toBe(200);
    expect(numbersOf(page.body.items)).toEqual([alpha.number, alphaMap.number]);
    expect(page.body.nextCursor).toEqual(expect.any(String));
  });
});
