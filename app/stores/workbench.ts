import { defineStore } from 'pinia';
import type { LocationQuery } from 'vue-router';
import type { EffortCount, IssuePage, IssueRow, LabelGroup } from '~/types/api';

const SCALAR_KEYS = ['view', 'kind', 'state', 'parent', 'effort', 'assignee', 'q', 'sort', 'order'] as const;

type ScalarKey = typeof SCALAR_KEYS[number];

export type WorkbenchFilters = Record<ScalarKey, string | null> & {
  labels: string[]
  missing: string[]
  numbers: number[]
};

const EMPTY_FILTERS: WorkbenchFilters = {
  view: null, kind: null, state: null, parent: null, effort: null, assignee: null, q: null, sort: null, order: null, labels: [], missing: [], numbers: [],
};

// Member ids are slugs or seeded `prefix:name` ids, so this can never collide with one.
export const NO_MEMBER = ':none';
const PAGE_SIZE = 100;
export const UNASSIGNED = 'none';
export const DEFAULT_SORT = 'updatedAt';
export const DEFAULT_ORDER = 'desc';
const API_SCALAR_KEYS = ['view', 'kind', 'parent', 'effort', 'assignee', 'q'] as const;

const valuesOf = (value: LocationQuery[string] | undefined) =>
  (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === 'string' && item !== '');

const toUrlQuery = (filters: WorkbenchFilters) => {
  const query: Record<string, string | string[]> = {};
  for (const key of SCALAR_KEYS) {
    const value = filters[key];
    if (value) query[key] = value;
  }
  if (filters.labels.length) query.label = filters.labels;
  if (filters.missing.length) query.missing = filters.missing;
  if (filters.numbers.length) query.numbers = filters.numbers.join(',');
  return query;
};

export const useWorkbenchStore = defineStore('workbench', () => {
  const uiFetch = useUiFetch();
  const labelGroupsStore = useLabelGroupsStore();
  const filters = ref<WorkbenchFilters>({ ...EMPTY_FILTERS });
  const rows = ref<IssueRow[]>([]);
  const nextCursor = ref<string | null>(null);
  const effortCounts = ref<EffortCount[]>([]);
  const hasMore = computed(() => nextCursor.value !== null);
  let latestRequest = 0;

  const readQuery = (query: LocationQuery) => {
    const scalars = Object.fromEntries(SCALAR_KEYS.map(key => [key, valuesOf(query[key])[0] ?? null]));
    filters.value = {
      ...EMPTY_FILTERS,
      ...scalars,
      labels: valuesOf(query.label),
      missing: valuesOf(query.missing),
      numbers: valuesOf(query.numbers).flatMap(list => list.split(',')).filter(part => /^\d+$/.test(part)).map(Number),
    };
  };

  const urlQuery = computed(() => toUrlQuery(filters.value));

  const grouped = computed(() => !filters.value.effort && !filters.value.numbers.length);

  const queryWith = (patch: Partial<WorkbenchFilters>) => toUrlQuery({ ...filters.value, ...patch });

  const queryForView = (view: string | null) => toUrlQuery({ ...EMPTY_FILTERS, view, sort: filters.value.sort, order: filters.value.order });

  const apiState = computed(() => {
    const { state, view, q } = filters.value;
    if (state === 'all') return null;
    return state ?? (view || q ? null : 'open');
  });

  const apiQuery = computed((): Record<string, string | number | string[]> => {
    if (filters.value.numbers.length) return { numbers: filters.value.numbers.join(',') };
    const query: Record<string, string | number | string[]> = {};
    for (const key of API_SCALAR_KEYS) {
      const value = filters.value[key];
      if (value) query[key] = value;
    }
    if (apiState.value) query.state = apiState.value;
    if (filters.value.labels.length) query.label = filters.value.labels;
    if (filters.value.missing.length) query.missing = filters.value.missing;
    return { ...query, sort: filters.value.sort ?? DEFAULT_SORT, order: filters.value.order ?? DEFAULT_ORDER, limit: PAGE_SIZE };
  });

  const queryWithSort = (sort: string) => {
    const naturalOrder = sort === DEFAULT_SORT ? DEFAULT_ORDER : 'asc';
    return queryWith({ sort: sort === DEFAULT_SORT ? null : sort, order: naturalOrder === DEFAULT_ORDER ? null : naturalOrder });
  };

  const groupChoice = (group: LabelGroup) => {
    if (filters.value.missing.includes(group.id)) return NO_MEMBER;
    return group.labels.find(member => filters.value.labels.includes(member.id))?.id ?? '';
  };

  const queryWithGroupChoice = (group: LabelGroup, choice: string) => {
    const memberIds = group.labels.map(member => member.id);
    const labels = filters.value.labels.filter(label => !memberIds.includes(label));
    const missing = filters.value.missing.filter(id => id !== group.id);
    if (choice === NO_MEMBER) return queryWith({ labels, missing: [...missing, group.id] });
    return queryWith({ labels: choice ? [...labels, choice] : labels, missing });
  };

  const groupMemberIds = computed(() => new Set(labelGroupsStore.labelGroups.flatMap(group => group.labels.map(member => member.id))));

  const chosenFreeFormLabels = computed(() => filters.value.labels.filter(label => !groupMemberIds.value.has(label)));

  const queryWithFreeFormLabels = (typed: string) => {
    const typedLabels = typed.split(',').map(label => label.trim()).filter(Boolean);
    return queryWith({ labels: [...filters.value.labels.filter(label => groupMemberIds.value.has(label)), ...typedLabels] });
  };

  const fetchPage = async (cursor: string | null) => {
    const request = ++latestRequest;
    const page = await uiFetch<IssuePage>('/issues', { query: { ...apiQuery.value, ...(cursor ? { cursor } : {}) } });
    return request === latestRequest ? page : null;
  };

  const load = async () => {
    const page = await fetchPage(null);
    if (!page) return;
    rows.value = page.items;
    nextCursor.value = page.nextCursor;
    effortCounts.value = page.effortCounts;
  };

  const effortTotal = (effort: number | null) => effortCounts.value.find(entry => entry.effort === effort)?.count ?? 0;

  const loadMore = async () => {
    const page = await fetchPage(nextCursor.value);
    if (!page) return;
    rows.value = [...rows.value, ...page.items];
    nextCursor.value = page.nextCursor;
  };

  return { filters, rows, nextCursor, effortCounts, effortTotal, hasMore, grouped, load, loadMore, readQuery, urlQuery, apiQuery, queryWith, queryForView, queryWithSort, groupChoice, queryWithGroupChoice, chosenFreeFormLabels, queryWithFreeFormLabels };
});
