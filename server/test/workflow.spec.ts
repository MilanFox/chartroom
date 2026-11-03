import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';

const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });
const conflict = { status: 409, body: { error: { code: 'conflict' } } };
const forbidden = { status: 403, body: { error: { code: 'forbidden' } } };
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
const createTicket = async (client: ReturnType<typeof apiClient>, title: string) => (await client.json('POST', '/issues', { body: { kind: 'ticket', title } })).body;

describe('claim, close, reopen and comments', () => {
  const server = useTestServer();
  let alice: ReturnType<typeof apiClient>;
  let bob: ReturnType<typeof apiClient>;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
    bob = apiClient(server, await holderSecret(server, 'bob', 'Bob'));
  });

  const ticket = (title: string) => createTicket(alice, title);

  it('claims for the caller, refuses a second holder, is idempotent, and anyone unassigns', async () => {
    const work = await ticket('Claim me');

    const claimed = await alice.json('POST', `/issues/${work.number}/claim`);
    expect(claimed.status).toBe(200);
    expect(claimed.body).toMatchObject({ assignee: 'alice', status: 'claimed', state: 'open', version: 1 });

    expect(await bob.json('POST', `/issues/${work.number}/claim`)).toMatchObject({ ...conflict, body: { error: { message: expect.stringContaining('alice') } } });
    expect((await alice.json('POST', `/issues/${work.number}/claim`)).body).toMatchObject({ assignee: 'alice', status: 'claimed' });

    const freed = await bob.json('DELETE', `/issues/${work.number}/assignee`);
    expect(freed.status).toBe(200);
    expect(freed.body).toMatchObject({ assignee: null, status: 'open' });
    expect((await bob.json('POST', `/issues/${work.number}/claim`)).body).toMatchObject({ assignee: 'bob', status: 'claimed' });
    expect(await alice.json('POST', '/issues/999999/claim')).toMatchObject({ status: 404 });
    expect(await alice.json('DELETE', '/issues/999999/assignee')).toMatchObject({ status: 404 });
  });
});

describe('close and reopen', () => {
  const server = useTestServer();
  let alice: ReturnType<typeof apiClient>;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const ticket = (title: string) => createTicket(alice, title);

  it('closes with a Resolution in one operation, refuses a second close, and reopen keeps the Resolution readable', async () => {
    const work = await ticket('Close me');

    const closed = await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: 'Shipped in #12' } });
    expect(closed.status).toBe(200);
    expect(closed.body).toMatchObject({ state: 'closed', status: 'closed', closedAt: expect.any(String), version: 1 });
    expect(closed.body.resolution).toEqual({
      id: expect.any(Number),
      issue: work.number,
      author: 'alice',
      body: 'Shipped in #12',
      origin: 'api',
      resolution: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      url: `${server.baseUrl}/issues/${work.number}#comment-${closed.body.resolution.id}`,
    });
    expect(closed.body.comments).toEqual([closed.body.resolution]);

    expect(await alice.json('POST', `/issues/${work.number}/close`)).toMatchObject(invalidOn('state'));
    expect(await alice.json('POST', `/issues/${work.number}/claim`)).toMatchObject(invalidOn('state'));

    const reopened = await alice.json('POST', `/issues/${work.number}/reopen`);
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({ state: 'open', status: 'open', closedAt: closed.body.closedAt, resolution: closed.body.resolution });
    expect(await alice.json('POST', `/issues/${work.number}/reopen`)).toMatchObject({ status: 200, body: { state: 'open' } });
    expect(await alice.json('POST', '/issues/999999/reopen')).toMatchObject({ status: 404 });
  });

  it('closes without a comment and leaves resolution null; an empty, blank or non-string comment is invalid and closes nothing', async () => {
    const work = await ticket('Plain close');

    expect(await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: 5 } })).toMatchObject(invalidOn('comment'));
    expect(await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: '' } })).toMatchObject(invalidOn('comment'));
    expect(await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: '  \n' } })).toMatchObject(invalidOn('comment'));
    expect((await alice.json('GET', `/issues/${work.number}`)).body).toMatchObject({ state: 'open', comments: [] });
    const closed = await alice.json('POST', `/issues/${work.number}/close`);
    expect(closed.body).toMatchObject({ state: 'closed', resolution: null, comments: [] });
  });

  it('a second close after reopen makes the newest flagged comment the Resolution; the first keeps its flag', async () => {
    const work = await ticket('Twice');
    const first = (await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: 'first answer' } })).body.resolution;
    await alice.json('POST', `/issues/${work.number}/reopen`);
    const second = (await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: 'second answer' } })).body;

    expect(second.resolution).toMatchObject({ body: 'second answer', resolution: true });
    expect(second.comments).toEqual([first, second.resolution]);
    expect(first.resolution).toBe(true);
  });
});

describe('comments', () => {
  const server = useTestServer();
  let alice: ReturnType<typeof apiClient>;
  let bob: ReturnType<typeof apiClient>;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
    bob = apiClient(server, await holderSecret(server, 'bob', 'Bob'));
  });

  const ticket = (title: string) => createTicket(alice, title);

  it('lists oldest first with url and pages; the author edits and deletes their own, another holder is forbidden; empty is invalid', async () => {
    const work = await ticket('Discuss');

    const first = await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: 'one' } });
    expect(first.status).toBe(201);
    expect(first.body).toEqual({
      id: expect.any(Number),
      issue: work.number,
      author: 'alice',
      body: 'one',
      origin: 'api',
      resolution: false,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      url: `${server.baseUrl}/issues/${work.number}#comment-${first.body.id}`,
    });
    const second = (await bob.json('POST', `/issues/${work.number}/comments`, { body: { body: 'two' } })).body;
    const third = (await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: 'three' } })).body;
    expect(await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: '' } })).toMatchObject(invalidOn('body'));
    expect(await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: ' \t ' } })).toMatchObject(invalidOn('body'));
    expect(await alice.json('POST', `/issues/${work.number}/comments`, { body: {} })).toMatchObject(invalidOn('body'));
    expect(await alice.json('POST', '/issues/999999/comments', { body: { body: 'x' } })).toMatchObject({ status: 404 });

    const page = await alice.json('GET', `/issues/${work.number}/comments?limit=2`);
    expect(page.body.items.map((comment: { body: string }) => comment.body)).toEqual(['one', 'two']);
    const rest = await alice.json('GET', `/issues/${work.number}/comments?limit=2&cursor=${page.body.nextCursor}`);
    expect(rest.body).toEqual({ items: [third], nextCursor: null });
    expect((await alice.json('GET', `/issues/${work.number}`)).body.comments).toEqual([first.body, second, third]);

    expect(await bob.json('PATCH', `/issues/${work.number}/comments/${first.body.id}`, { body: { body: 'hijack' } })).toMatchObject(forbidden);
    expect(await bob.json('DELETE', `/issues/${work.number}/comments/${first.body.id}`)).toMatchObject(forbidden);
    expect(await alice.json('PATCH', `/issues/${work.number}/comments/${first.body.id}`, { body: { body: '' } })).toMatchObject(invalidOn('body'));
    await sleep(5);
    const edited = await alice.json('PATCH', `/issues/${work.number}/comments/${first.body.id}`, { body: { body: 'one!' } });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ ...first.body, body: 'one!', updatedAt: expect.any(String) });
    expect(edited.body.updatedAt > first.body.updatedAt).toBe(true);

    expect(await alice.json('DELETE', `/issues/${work.number}/comments/${first.body.id}`)).toMatchObject({ status: 204 });
    expect(await alice.json('DELETE', `/issues/${work.number}/comments/${first.body.id}`)).toMatchObject({ status: 404 });
    expect(await alice.json('GET', `/issues/999999/comments/${second.id}`)).toMatchObject({ status: 404 });
    expect(await alice.json('PATCH', `/issues/${work.number}/comments/999999`, { body: { body: 'x' } })).toMatchObject({ status: 404 });
    expect((await alice.json('GET', `/issues/${work.number}/comments`)).body.items).toEqual([second, third]);
  });

  it('deleting the Resolution leaves the issue closed with resolution null', async () => {
    const work = await ticket('Resolved');
    const closed = (await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: 'done' } })).body;

    expect(await alice.json('DELETE', `/issues/${work.number}/comments/${closed.resolution.id}`)).toMatchObject({ status: 204 });
    expect((await alice.json('GET', `/issues/${work.number}`)).body).toMatchObject({ state: 'closed', status: 'closed', resolution: null, comments: [] });
  });

  it('comments created outside close never carry the resolution flag', async () => {
    const work = await ticket('Plain');
    const comment = (await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: 'note', resolution: true } })).body;
    expect(comment.resolution).toBe(false);
  });
});

describe('Change log, timestamps and the Viewer wall', () => {
  const server = useTestServer();
  let alice: ReturnType<typeof apiClient>;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const ticket = (title: string) => createTicket(alice, title);
  const fieldsOf = async (number: number) =>
    (await alice.json('GET', `/issues/${number}/changes`)).body.items.map(({ field, before, after }: { field: string, before: string | null, after: string | null }) => [field, before, after]);

  it('logs state on close and reopen, assignee on claim and unassign, comment with the id on deletion, nothing for creation or edit', async () => {
    const work = await ticket('Logged');

    await alice.json('POST', `/issues/${work.number}/claim`);
    await alice.json('DELETE', `/issues/${work.number}/assignee`);
    const comment = (await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: 'c' } })).body;
    await alice.json('PATCH', `/issues/${work.number}/comments/${comment.id}`, { body: { body: 'c!' } });
    await alice.json('POST', `/issues/${work.number}/close`, { body: { comment: 'resolved' } });
    await alice.json('POST', `/issues/${work.number}/reopen`);
    await alice.json('DELETE', `/issues/${work.number}/comments/${comment.id}`);

    expect(await fieldsOf(work.number)).toEqual([
      ['assignee', null, 'alice'],
      ['assignee', 'alice', null],
      ['state', 'open', 'closed'],
      ['state', 'closed', 'open'],
      ['comment', String(comment.id), null],
    ]);
    expect((await alice.json('GET', `/issues/${work.number}/changes`)).body.items[4]).toMatchObject({ actor: 'alice', origin: 'api' });
  });

  it('a comment, a claim and a close bump updatedAt and leave version unchanged', async () => {
    const work = await ticket('Stamped');

    await sleep(5);
    const commented = (await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: 'c' } })).body;
    const afterComment = (await alice.json('GET', `/issues/${work.number}`)).body;
    await sleep(5);
    const claimed = (await alice.json('POST', `/issues/${work.number}/claim`)).body;
    await sleep(5);
    const closed = (await alice.json('POST', `/issues/${work.number}/close`)).body;

    expect(afterComment.updatedAt).toBe(commented.createdAt);
    expect(afterComment.updatedAt > work.updatedAt).toBe(true);
    expect(claimed.updatedAt > afterComment.updatedAt).toBe(true);
    expect(closed.updatedAt > claimed.updatedAt).toBe(true);
    expect([afterComment.version, claimed.version, closed.version]).toEqual([1, 1, 1]);
    expect((await alice.json('GET', `/issues?numbers=${work.number}`)).body.items[0]).toMatchObject({ status: 'closed', assignee: 'alice' });
  });

  it('a comment through /ui carries origin ui and bumps nothing but updatedAt', async () => {
    const desk = uiClient(server);
    await desk.login(await holderSecret(server, 'desk', 'Desk'));
    const work = await ticket('From the desk');

    const comment = await desk.json('POST', `/issues/${work.number}/comments`, { body: { body: 'hello' } });
    expect(comment.status).toBe(201);
    expect(comment.body).toMatchObject({ author: 'desk', origin: 'ui' });
    expect(await alice.json('DELETE', `/issues/${work.number}/comments/${comment.body.id}`)).toMatchObject(forbidden);
    expect(await desk.json('DELETE', `/issues/${work.number}/comments/${comment.body.id}`)).toMatchObject({ status: 204 });
  });

  it('a Viewer session is forbidden on every write here and reads comments', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const work = await ticket('Viewer');
    const comment = (await alice.json('POST', `/issues/${work.number}/comments`, { body: { body: 'c' } })).body;

    expect(await viewer.json('POST', `/issues/${work.number}/claim`)).toMatchObject(forbidden);
    expect(await viewer.json('DELETE', `/issues/${work.number}/assignee`)).toMatchObject(forbidden);
    expect(await viewer.json('POST', `/issues/${work.number}/close`)).toMatchObject(forbidden);
    expect(await viewer.json('POST', `/issues/${work.number}/reopen`)).toMatchObject(forbidden);
    expect(await viewer.json('POST', `/issues/${work.number}/comments`, { body: { body: 'x' } })).toMatchObject(forbidden);
    expect(await viewer.json('PATCH', `/issues/${work.number}/comments/${comment.id}`, { body: { body: 'x' } })).toMatchObject(forbidden);
    expect(await viewer.json('DELETE', `/issues/${work.number}/comments/${comment.id}`)).toMatchObject(forbidden);
    expect((await viewer.json('GET', `/issues/${work.number}/comments`)).body.items).toEqual([comment]);
  });
});
