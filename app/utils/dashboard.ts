import type { IssueRow, IssueStatus, LinkRole, LinkRollup } from '~/types/api';
import { formatString } from './strings';

export type TicketSort = 'number' | 'state' | 'title';

export interface TicketFilter {
  query: string
  states: IssueStatus[]
  label: string | null
  assignee: string | null
  sort: TicketSort
}

export interface TicketGroup {
  key: string
  spec: IssueRow | null
  labelled: boolean
  rows: IssueRow[]
}

interface EffortTree {
  number: number
  specs: IssueRow[]
}

// Holder slugs never contain a colon, so this can never collide with one.
export const NO_ASSIGNEE = ':none';

export const STATUSES: IssueStatus[] = ['open', 'claimed', 'blocked', 'closed'];

export const DEFAULT_TICKET_FILTER: TicketFilter = { query: '', states: [], label: null, assignee: null, sort: 'number' };

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
type CompareRows = (a: IssueRow, b: IssueRow) => number;

const COMPARE_BY: Record<TicketSort, CompareRows> = {
  number: () => 0,
  state: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
  title: (a, b) => compareText(a.title, b.title),
};

const matchesQuery = (row: IssueRow, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return needle.replace(/^#/, '') === String(row.number) || row.title.toLowerCase().includes(needle);
};

const matchesAssignee = (row: IssueRow, assignee: string | null) =>
  assignee === null || (assignee === NO_ASSIGNEE ? row.assignee === null : row.assignee === assignee);

export const filterTickets = (rows: IssueRow[], filter: TicketFilter) => rows
  .filter(row => matchesQuery(row, filter.query)
    && (!filter.states.length || filter.states.includes(row.status))
    && (filter.label === null || row.labels.includes(filter.label))
    && matchesAssignee(row, filter.assignee))
  .sort((a, b) => COMPARE_BY[filter.sort](a, b) || a.number - b.number);

const ticketsUnder = (effort: EffortTree, rows: IssueRow[]) => {
  const parents = new Set([effort.number, ...effort.specs.map(spec => spec.number)]);
  return rows.filter(row => row.kind === 'ticket' && row.parent !== null && parents.has(row.parent));
};

export const ticketGroups = (effort: EffortTree, rows: IssueRow[], filter: TicketFilter): TicketGroup[] => {
  const tickets = filterTickets(ticketsUnder(effort, rows), filter);
  const specGroups = effort.specs.map(spec => ({ key: `spec-${spec.number}`, spec, labelled: effort.specs.length > 1, rows: tickets.filter(row => row.parent === spec.number) }));
  const triage = { key: 'triage', spec: null, labelled: true, rows: tickets.filter(row => row.parent === effort.number) };
  return [...specGroups, triage].filter(group => group.rows.length);
};

export const ticketFilterOptions = (effort: EffortTree, rows: IssueRow[]) => {
  const tickets = ticketsUnder(effort, rows);
  return {
    labels: [...new Set(tickets.flatMap(row => row.labels))].sort(compareText),
    assignees: [...new Set(tickets.flatMap(row => (row.assignee ? [row.assignee] : [])))].sort(compareText),
  };
};

export const decisionTickets = (map: number, rows: IssueRow[], { query, states }: Pick<TicketFilter, 'query' | 'states'>) =>
  filterTickets(rows.filter(row => row.parent === map), { ...DEFAULT_TICKET_FILTER, query, states });

export const EMPTY_STATUS_COUNTS: Readonly<Record<IssueStatus, number>> = { open: 0, claimed: 0, blocked: 0, closed: 0 };

export const countByStatus = (rows: Pick<IssueRow, 'status'>[]) => {
  const counts = { ...EMPTY_STATUS_COUNTS };
  for (const row of rows) counts[row.status] += 1;
  return counts;
};

const LINK_ROLES: LinkRole[] = ['resource', 'artifact'];

export const rollupSections = (rollup: LinkRollup, effort: Pick<IssueRow, 'number' | 'state'>, rows: IssueRow[]) => {
  const stateOf = new Map([effort, ...rows].map(issue => [issue.number, issue.state]));
  return LINK_ROLES.map(role => ({
    role,
    links: rollup[role].map(link => ({ ...link, sources: link.sources.map(number => ({ number, closed: stateOf.get(number) === 'closed' })) })),
  }));
};

export const artifactCountOf = (spec: number, rollup: LinkRollup, rows: IssueRow[]) => {
  const specIssues = new Set([spec, ...rows.filter(row => row.parent === spec).map(row => row.number)]);
  return rollup.artifact.filter(link => link.sources.some(source => specIssues.has(source))).length;
};

interface TriageLabels {
  triageBucket: string
  triageNoState: string
  separator: string
}

export const triageSummaryOf = (triage: Record<string, number>, displayLabels: Record<string, string>, labels: TriageLabels) => {
  const buckets = Object.entries(triage).filter(([, count]) => count > 0);
  return {
    count: buckets.reduce((sum, [, count]) => sum + count, 0),
    buckets: buckets
      .map(([id, count]) => formatString(labels.triageBucket, { count, label: id === 'none' ? labels.triageNoState : displayLabels[id] ?? id }))
      .join(labels.separator),
  };
};

export const bodyExcerpt = (body: string) =>
  body.split(/\n\s*\n/).map(paragraph => paragraph.trim()).find(paragraph => paragraph && !paragraph.startsWith('#') && !paragraph.startsWith('<!--'))?.replace(/\s+/g, ' ') ?? '';
