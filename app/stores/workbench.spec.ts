import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { issueFixture } from '~/test/issue-fixture';
import { useLabelGroupsStore } from './label-groups';
import { NO_MEMBER, useWorkbenchStore } from './workbench';

const wayfinderType = { id: 'wayfinder-type', displayName: 'Wayfinder type', seeded: true, exclusive: true as const, labels: [{ id: 'wayfinder:task', displayLabel: 'Task' }] };
const triageState = { id: 'triage-state', displayName: 'Triage state', seeded: true, exclusive: true as const, labels: [{ id: 'needs-triage', displayLabel: 'Needs triage' }, { id: 'ready-for-agent', displayLabel: 'Ready for an agent' }] };

const unregister: (() => void)[] = [];
const searchOf = (event: unknown) => new URL((event as { web: { request: Request } }).web.request.url).searchParams;

describe('useWorkbenchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('round-trips every URL parameter under the API names', () => {
    const workbench = useWorkbenchStore();
    const url = {
      view: 'frontier',
      kind: 'ticket',
      state: 'closed',
      label: ['needs-triage', 'docs'],
      parent: '2',
      effort: 'tracker',
      assignee: 'milan',
      missing: ['wayfinder-type', 'priority'],
      numbers: '5,2,9',
      q: 'cursor',
      sort: 'number',
      order: 'asc',
    };

    workbench.readQuery(url);

    expect(workbench.urlQuery).toEqual(url);
    expect(workbench.grouped).toBe(false);
  });

  it('asks the API for open issues by updatedAt desc when the URL is bare', () => {
    const workbench = useWorkbenchStore();

    workbench.readQuery({});

    expect(workbench.urlQuery).toEqual({});
    expect(workbench.grouped).toBe(true);
    expect(workbench.apiQuery).toEqual({ state: 'open', sort: 'updatedAt', order: 'desc', limit: 100 });
  });

  it('translates state=all into no state filter on the API call', () => {
    const workbench = useWorkbenchStore();

    workbench.readQuery({ state: 'all', kind: 'map', label: 'needs-triage' });

    expect(workbench.urlQuery).toEqual({ state: 'all', kind: 'map', label: ['needs-triage'] });
    expect(workbench.apiQuery).toEqual({ kind: 'map', label: ['needs-triage'], sort: 'updatedAt', order: 'desc', limit: 100 });
  });

  it('drops the open-only default while the search box has a query, unless the URL pins a state', () => {
    const workbench = useWorkbenchStore();

    workbench.readQuery({ q: 'cursor' });
    expect(workbench.apiQuery).toEqual({ q: 'cursor', sort: 'updatedAt', order: 'desc', limit: 100 });

    workbench.readQuery({ q: 'cursor', state: 'open' });
    expect(workbench.apiQuery).toMatchObject({ q: 'cursor', state: 'open' });
  });

  it('asks only for the numbers= set, in the given order, ignoring every other filter', () => {
    const workbench = useWorkbenchStore();

    workbench.readQuery({ numbers: '5,2,9', state: 'open', kind: 'map', sort: 'title' });

    expect(workbench.urlQuery).toEqual({ numbers: '5,2,9', state: 'open', kind: 'map', sort: 'title' });
    expect(workbench.apiQuery).toEqual({ numbers: '5,2,9' });
    expect(workbench.grouped).toBe(false);
  });

  it('resets search and every other filter when a Saved view is picked, keeping the sort', () => {
    const workbench = useWorkbenchStore();
    workbench.readQuery({ q: 'cursor', kind: 'map', state: 'all', label: 'docs', parent: '2', effort: 'tracker', assignee: 'none', missing: ['triage-state', 'priority'], numbers: '4', sort: 'number', order: 'asc' });

    const frontier = workbench.queryForView('frontier');
    workbench.readQuery(frontier);
    const narrowed = workbench.queryWith({ kind: 'ticket' });

    expect(frontier).toEqual({ view: 'frontier', sort: 'number', order: 'asc' });
    expect(narrowed).toEqual({ view: 'frontier', kind: 'ticket', sort: 'number', order: 'asc' });
  });

  it('maps a Label group select onto label= and its "No <group>" entry onto missing=, one group independent of another', () => {
    const workbench = useWorkbenchStore();
    workbench.readQuery({ label: ['needs-triage', 'docs'], missing: 'wayfinder-type' });
    expect(workbench.groupChoice(triageState)).toBe('needs-triage');
    expect(workbench.groupChoice(wayfinderType)).toBe(NO_MEMBER);

    workbench.readQuery(workbench.queryWithGroupChoice(triageState, NO_MEMBER));
    expect(workbench.urlQuery).toEqual({ label: ['docs'], missing: ['wayfinder-type', 'triage-state'] });
    expect(workbench.apiQuery).toMatchObject({ label: ['docs'], missing: ['wayfinder-type', 'triage-state'] });

    workbench.readQuery(workbench.queryWithGroupChoice(triageState, 'ready-for-agent'));
    expect(workbench.urlQuery).toEqual({ label: ['docs', 'ready-for-agent'], missing: ['wayfinder-type'] });

    workbench.readQuery(workbench.queryWithGroupChoice(wayfinderType, ''));
    expect(workbench.urlQuery).toEqual({ label: ['docs', 'ready-for-agent'] });
  });

  it('splits label= into group members and free-form labels, and replaces only the free-form ones from the typed list', () => {
    useLabelGroupsStore().labelGroups = [triageState, wayfinderType];
    const workbench = useWorkbenchStore();
    workbench.readQuery({ label: ['needs-triage', 'docs', 'frontend'] });

    expect(workbench.chosenFreeFormLabels).toEqual(['docs', 'frontend']);
    expect(workbench.queryWithFreeFormLabels(' api , docs,')).toEqual({ label: ['needs-triage', 'api', 'docs'] });
  });

  it('gives a newly chosen sort its natural order: newest first for updated, ascending for the rest', () => {
    const workbench = useWorkbenchStore();
    workbench.readQuery({ kind: 'ticket' });

    expect(workbench.queryWithSort('priority')).toEqual({ kind: 'ticket', sort: 'priority', order: 'asc' });
    expect(workbench.queryWithSort('title')).toEqual({ kind: 'ticket', sort: 'title', order: 'asc' });

    workbench.readQuery({ kind: 'ticket', sort: 'number', order: 'asc' });
    expect(workbench.queryWithSort('updatedAt')).toEqual({ kind: 'ticket' });

    workbench.readQuery({ sort: 'priority', order: 'desc' });
    expect(workbench.urlQuery).toEqual({ sort: 'priority', order: 'desc' });
  });

  it('loads the first page with its per-Effort totals, then appends the next 100 by cursor without touching the URL', async () => {
    const requests: string[] = [];
    unregister.push(registerEndpoint('/ui/issues', (event) => {
      const search = searchOf(event);
      requests.push(search.toString());
      return search.get('cursor') === 'page-2'
        ? { items: [issueFixture({ number: 3 })], nextCursor: null, effortCounts: [{ effort: 1, count: 3 }] }
        : { items: [issueFixture({ number: 9 }), issueFixture({ number: 5 })], nextCursor: 'page-2', effortCounts: [{ effort: 1, count: 3 }] };
    }));
    const workbench = useWorkbenchStore();
    workbench.readQuery({ label: ['needs-triage', 'docs'] });

    await workbench.load();
    expect(workbench.hasMore).toBe(true);
    expect(workbench.effortTotal(1)).toBe(3);
    await workbench.loadMore();

    expect(requests).toEqual([
      'state=open&label=needs-triage&label=docs&sort=updatedAt&order=desc&limit=100',
      'state=open&label=needs-triage&label=docs&sort=updatedAt&order=desc&limit=100&cursor=page-2',
    ]);
    expect(workbench.rows.map(row => row.number)).toEqual([9, 5, 3]);
    expect(workbench.hasMore).toBe(false);
    expect(workbench.urlQuery).toEqual({ label: ['needs-triage', 'docs'] });
  });
});
