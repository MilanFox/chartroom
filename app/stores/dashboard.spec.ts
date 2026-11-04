import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EffortDocument, IssueDocument } from '~/types/api';
import { issueFixture } from '~/test/issue-fixture';
import { useDashboardStore } from './dashboard';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));
const searchOf = (event: unknown) => new URL((event as { web: { request: Request } }).web.request.url).searchParams;

const row = (number: number, overrides: Partial<IssueDocument> = {}) => issueFixture({ number, title: `Issue ${number}`, effort: 1, ...overrides });

const effortDocument = (overrides: Partial<EffortDocument> = {}): EffortDocument => ({
  ...issueFixture({ number: 1, kind: 'effort', title: 'Agent tracker', parent: null, effort: 1 }),
  name: 'tracker',
  testInstructions: null,
  statusRollup: { map: { state: 'open', frontier: 1 }, specs: [{ number: 5, tickets: { open: 1, claimed: 0, blocked: 0, closed: 1 } }], triage: { 'needs-triage': 1, 'none': 0 }, open: 4 },
  linkRollup: { resource: [], artifact: [] },
  map: row(2, { kind: 'map', parent: 1 }),
  specs: [row(5, { kind: 'spec', parent: 1 })],
  ...overrides,
});

describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('loads the Effort document, the map and spec bodies and every issue of the subtree, following each cursor', async () => {
    const listRequests: string[] = [];
    endpoint('/ui/efforts/1', () => effortDocument());
    endpoint('/ui/issues/2', () => row(2, { kind: 'map', parent: 1, body: 'Map body' }));
    endpoint('/ui/issues/5', () => row(5, { kind: 'spec', parent: 1, body: 'Spec body' }));
    endpoint('/ui/issues', (event) => {
      const search = searchOf(event);
      listRequests.push(search.toString());
      return search.get('cursor') === 'page-2'
        ? { items: [row(6, { parent: 5 }), row(7, { parent: 1, state: 'closed', status: 'closed' })], nextCursor: null, effortCounts: [] }
        : { items: [effortDocument(), row(2, { kind: 'map', parent: 1 }), row(3, { parent: 2 }), row(5, { kind: 'spec', parent: 1 })], nextCursor: 'page-2', effortCounts: [] };
    });
    const dashboard = useDashboardStore();

    await dashboard.load(1);

    expect(listRequests).toEqual([
      'effort=1&sort=number&order=asc&limit=200',
      'effort=1&sort=number&order=asc&limit=200&cursor=page-2',
    ]);
    expect(dashboard.effort?.name).toBe('tracker');
    expect(dashboard.rows.map(({ number }) => number)).toEqual([2, 3, 5, 6, 7]);
    expect(dashboard.parentBodies[2]).toBe('Map body');
    expect(dashboard.parentBodies[5]).toBe('Spec body');
  });

  it('counts the open issues under the Effort, the Effort itself excluded, for the close warning', async () => {
    endpoint('/ui/efforts/1', () => effortDocument({ map: null, specs: [] }));
    endpoint('/ui/issues', () => ({
      items: [effortDocument(), row(3, { parent: 1 }), row(4, { parent: 1, state: 'closed', status: 'closed' }), row(6, { parent: 1, status: 'blocked' })],
      nextCursor: null,
      effortCounts: [],
    }));
    const dashboard = useDashboardStore();

    await dashboard.load(1);

    expect(dashboard.openChildren).toBe(2);
  });

  it('copies the Artifacts as the server renders them, one markdown line per Artifact', async () => {
    endpoint('/ui/efforts/1', () => effortDocument({ map: null, specs: [] }));
    endpoint('/ui/issues', () => ({ items: [], nextCursor: null, effortCounts: [] }));
    endpoint('/ui/efforts/1/artifacts.md', () => new Response('- [ADR 0001](https://example.test/adr)\n- [research/cursor](https://example.test/branch)\n', { headers: { 'content-type': 'text/markdown; charset=utf-8' } }));
    const dashboard = useDashboardStore();
    await dashboard.load(1);

    expect(await dashboard.artifactsMarkdown()).toBe('- [ADR 0001](https://example.test/adr)\n- [research/cursor](https://example.test/branch)\n');
  });

  it('lists the Environments and leaves the Credential pointers out when the session may not see them', async () => {
    endpoint('/ui/environments', () => [{ id: 1, name: 'Staging', url: 'https://staging.example.test', notes: null }]);
    endpoint('/ui/credential-pointers', () => new Response(JSON.stringify({ error: { code: 'forbidden', message: 'no' } }), { status: 403, headers: { 'content-type': 'application/json' } }));
    const dashboard = useDashboardStore();

    await dashboard.loadEnvironments();

    expect(dashboard.environments.map(({ name }) => name)).toEqual(['Staging']);
    expect(dashboard.pointers).toBeNull();
  });
});
