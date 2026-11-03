import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret } from './clients';
import { useTestServer } from './harness';

const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });
const notFound = { status: 404, body: { error: { code: 'not-found' } } };
const conflict = { status: 409, body: { error: { code: 'conflict' } } };
type Client = ReturnType<typeof apiClient>;
const createTicket = async (client: Client, title: string, extra: Record<string, unknown> = {}) =>
  (await client.json('POST', '/issues', { body: { kind: 'ticket', title, ...extra } })).body;
const addLink = (client: Client, number: number, link: Record<string, unknown>) =>
  client.json('POST', `/issues/${number}/links`, { body: { role: 'artifact', type: 'branch', url: 'https://git.example/x', title: 'X', ...link } });

describe('links', () => {
  const server = useTestServer();
  let alice: Client;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  it('accepts a Link with each role and type, lists and pages them by id, and shows them on the Document', async () => {
    const ticket = await createTicket(alice, 'T');
    const created = await addLink(alice, ticket.number, { role: 'resource', type: 'doc', url: 'https://figma.example/brief', title: 'Brief' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: expect.any(Number),
      issue: ticket.number,
      role: 'resource',
      type: 'doc',
      url: 'https://figma.example/brief',
      title: 'Brief',
      addedBy: 'alice',
      origin: 'api',
      createdAt: expect.any(String),
    });
    for (const [role, type, url] of [['artifact', 'branch', 'https://git.example/tree/feat'], ['artifact', 'file', 'https://git.example/blob/findings.md'], ['artifact', 'preview', 'https://pr-12.example'], ['resource', 'external', 'https://example.com']]) {
      expect((await addLink(alice, ticket.number, { role, type, url, title: type })).status).toBe(201);
    }

    const page = (await alice.json('GET', `/issues/${ticket.number}/links?limit=3`)).body;
    expect(page.items.map((link: { type: string }) => link.type)).toEqual(['doc', 'branch', 'file']);
    const rest = (await alice.json('GET', `/issues/${ticket.number}/links?limit=3&cursor=${page.nextCursor}`)).body;
    expect(rest).toMatchObject({ items: [{ type: 'preview' }, { type: 'external' }], nextCursor: null });

    const document = (await alice.json('GET', `/issues/${ticket.number}`)).body;
    expect(document.links.map((link: { id: number }) => link.id)).toEqual([...page.items, ...rest.items].map(link => link.id));
    expect(document.links[0]).toEqual(created.body);
    expect(document.version).toBe(1);
    expect(document.updatedAt > ticket.updatedAt).toBe(true);
    expect(await alice.json('GET', '/issues/999999/links')).toMatchObject(notFound);
  });

  it('refuses a bad role, type, url or title as invalid naming the field; the same URL on the same issue is conflict, on another issue fine', async () => {
    const ticket = await createTicket(alice, 'T');
    const other = await createTicket(alice, 'U');
    expect(await addLink(alice, ticket.number, { role: 'owner' })).toMatchObject(invalidOn('role'));
    expect(await addLink(alice, ticket.number, { type: 'video' })).toMatchObject(invalidOn('type'));
    expect(await addLink(alice, ticket.number, { url: 'repo#prototype/auth' })).toMatchObject(invalidOn('url'));
    expect(await addLink(alice, ticket.number, { url: '/relative' })).toMatchObject(invalidOn('url'));
    expect(await addLink(alice, ticket.number, { title: ' ' })).toMatchObject(invalidOn('title'));
    expect(await alice.json('POST', `/issues/${ticket.number}/links`, { body: { type: 'doc', url: 'https://x.example', title: 'x' } })).toMatchObject(invalidOn('role'));
    expect(await addLink(alice, 999999, {})).toMatchObject(notFound);

    expect((await addLink(alice, ticket.number, { url: 'https://x.example', title: 'a' })).status).toBe(201);
    expect(await addLink(alice, ticket.number, { role: 'resource', url: 'https://x.example', title: 'b' })).toMatchObject(conflict);
    expect((await addLink(alice, other.number, { url: 'https://x.example', title: 'c' })).status).toBe(201);
  });

  it('edits role, type and title and removes a Link recording a link Change with id, title and url in before; version stays', async () => {
    const ticket = await createTicket(alice, 'T');
    const { body: link } = await addLink(alice, ticket.number, { url: 'https://pr-12.example', title: 'Preview' });

    const edited = await alice.json('PATCH', `/issues/${ticket.number}/links/${link.id}`, { body: { role: 'resource', type: 'preview', title: 'Preview 12', url: 'https://ignored.example' } });
    expect(edited).toMatchObject({ status: 200, body: { id: link.id, role: 'resource', type: 'preview', title: 'Preview 12', url: 'https://pr-12.example' } });
    expect(await alice.json('PATCH', `/issues/${ticket.number}/links/${link.id}`, { body: { role: 'nope' } })).toMatchObject(invalidOn('role'));
    expect(await alice.json('PATCH', `/issues/${ticket.number}/links/${link.id}`, { body: { title: '' } })).toMatchObject(invalidOn('title'));
    expect(await alice.json('PATCH', `/issues/${ticket.number}/links/999999`, { body: { title: 'x' } })).toMatchObject(notFound);

    expect(await alice.json('DELETE', `/issues/${ticket.number}/links/${link.id}`)).toMatchObject({ status: 204 });
    expect(await alice.json('DELETE', `/issues/${ticket.number}/links/${link.id}`)).toMatchObject(notFound);
    const changes = (await alice.json('GET', `/issues/${ticket.number}/changes?field=link`)).body.items;
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ field: 'link', actor: 'alice', after: null });
    expect(JSON.parse(changes[0].before)).toEqual({ id: link.id, title: 'Preview 12', url: 'https://pr-12.example' });
    expect((await alice.json('GET', `/issues/${ticket.number}`)).body).toMatchObject({ version: 1, links: [] });
  });
});
