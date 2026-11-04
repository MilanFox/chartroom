import type { Effort, StatusRollup } from '~/types/api';
import { STATUSES } from '#shared/domain';

export type EffortSortKey = 'number' | 'title' | 'status' | 'open' | 'createdBy';
export type SortDirection = 'ascending' | 'descending';

export interface EffortView {
  query: string
  tags: string[]
  showClosed: boolean
  sortKey: EffortSortKey
  sortDirection: SortDirection
}

export const DEFAULT_EFFORT_VIEW: EffortView = { query: '', tags: [], showClosed: false, sortKey: 'number', sortDirection: 'descending' };

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

const SORT_VALUE_OF = {
  number: (effort: Effort) => effort.number,
  title: (effort: Effort) => effort.title,
  status: (effort: Effort) => STATUSES.indexOf(effort.status),
  open: (effort: Effort) => effort.statusRollup.open,
  createdBy: (effort: Effort) => effort.createdBy,
} satisfies Record<EffortSortKey, unknown>;

const compareValues = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : compareText(String(a), String(b));

const matchesQuery = (effort: Effort, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (needle.replace(/^#/, '') === String(effort.number)) return true;
  return effort.title.toLowerCase().includes(needle) || (effort.name ?? '').includes(needle);
};

export const effortsInView = (efforts: Effort[], view: EffortView) => {
  const valueOf = SORT_VALUE_OF[view.sortKey];
  const direction = view.sortDirection === 'ascending' ? 1 : -1;
  return efforts
    .filter(effort => (view.showClosed || effort.state !== 'closed') && matchesQuery(effort, view.query) && view.tags.every(tag => effort.labels.includes(tag)))
    .sort((a, b) => direction * compareValues(valueOf(a), valueOf(b)) || a.number - b.number);
};

export const tagsAcross = (efforts: Effort[]) => [...new Set(efforts.flatMap(effort => effort.labels))].sort(compareText);

export const rollupGist = (rollup: StatusRollup) => {
  const specTickets = rollup.specs.flatMap(spec => Object.values(spec.tickets));
  return {
    open: rollup.open,
    frontier: rollup.map?.state === 'open' ? rollup.map.frontier : null,
    closedTickets: rollup.specs.reduce((sum, spec) => sum + (spec.tickets.closed ?? 0), 0),
    specTickets: specTickets.reduce((sum, count) => sum + count, 0),
  };
};
