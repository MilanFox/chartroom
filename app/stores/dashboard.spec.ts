import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { requestOf, searchOf, useEndpoints } from '~/test/endpoints';
import type { EffortDocument, IssueDocument } from '~/types/api';
import { issueFixture } from '~/test/issue-fixture';
import { useDashboardStore } from './dashboard';

const endpoint = useEndpoints();

const row = (number: number, overrides: Partial<IssueDocument> = {}) => issueFixture({ number, title: `Issue ${number}`, effort: 1, ...overrides });

const effortDocument = (overrides: Partial<EffortDocument> = {}): EffortDocument => ({
  ...issueFixture({ number: 1, kind: 'effort', title: 'Agent tracker', parent: null, effort: 1 }),
  name: 'tracker',
  testInstructions: null,
  statusRollup: { map: { state: 'open', frontier: 1 }, specs: [{ number: 5, tickets: { open: 1, claimed: 0, blocked: 0, closed: 1 } }], triage: { 'needs-triage': 1, 'none': 0 }, open: 4 },
  linkRollup: { resource: [], artifact: [] },
  researchRollup: [],
  map: { ...row(2, { kind: 'map', parent: 1 }), excerpt: 'Map body' },
  specs: [{ ...row(5, { kind: 'spec', parent: 1 }), excerpt: 'Spec body' }],
  ...overrides,
});

describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('loads the Effort document with its map and spec excerpts and every issue of the subtree, following each cursor', async () => {
    const listRequests: string[] = [];
    const documentRequests: string[] = [];
    endpoint('/ui/efforts/1', () => effortDocument());
    endpoint('/ui/issues/:number', (event) => {
      documentRequests.push(new URL(requestOf(event).url).pathname);
      return row(2);
    });
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
    expect(dashboard.effort?.map?.excerpt).toBe('Map body');
    expect(dashboard.effort?.specs.map(({ excerpt }) => excerpt)).toEqual(['Spec body']);
    expect(documentRequests).toEqual([]);
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
});
