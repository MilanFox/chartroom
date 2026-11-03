import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { issues, labelGroupMembers, links } from '../db/schema';
import type { IssueCursor, IssueRecord, IssueStatus, SortOrder } from './issues';
import type { LinkRecord, LinkRole, LinkType } from './links';

export type EffortSort = 'updatedAt' | 'name';

export const EFFORT_SORTS: EffortSort[] = ['updatedAt', 'name'];

export interface EffortQuery {
  sort: EffortSort
  order: SortOrder
  after?: IssueCursor | null
  limit: number
}

export interface RolledUpLink {
  url: string
  title: string
  type: LinkType
  sources: number[]
}

export type LinkRollup = Record<LinkRole, RolledUpLink[]>;

export interface StatusRollup {
  map: { state: string, frontier: number } | null
  specs: { number: number, tickets: Record<IssueStatus, number> }[]
  triage: Record<string, number>
  open: number
}

const SORT_COLUMNS = { updatedAt: issues.updatedAt, name: issues.name };

export const resolveEffort = (handle: string): IssueRecord => {
  if (/^\d+$/.test(handle)) {
    const issue = findIssue(Number(handle));
    if (!issue) throw notFound(`issue #${handle} does not exist`);
    if (issue.kind !== 'effort') throw invalid(`issue #${handle} is a ${issue.kind}, not an Effort`, 'handle');
    return issue;
  }
  const effort = useStore().select().from(issues).where(eq(issues.name, handle)).get();
  if (!effort) throw notFound(`effort ${handle} does not exist`);
  return effort;
};

export const listEfforts = ({ sort, order, after, limit }: EffortQuery): IssueRecord[] => {
  const column = SORT_COLUMNS[sort];
  const conditions = [eq(issues.kind, 'effort')];
  if (after) conditions.push(beyondCursorOn(column, order, after));
  const direction = order === 'asc' ? asc : desc;
  return useStore().select().from(issues).where(and(...conditions)).orderBy(direction(column), direction(issues.number)).limit(limit).all();
};

const rollUp = (bucket: RolledUpLink[], link: LinkRecord) => {
  const existing = bucket.find(entry => entry.url === link.url);
  if (existing) existing.sources.push(link.issue);
  else bucket.push({ url: link.url, title: link.title, type: link.type as LinkType, sources: [link.issue] });
};

export const linkRollupOf = (effort: number): LinkRollup => {
  const rollup: LinkRollup = { resource: [], artifact: [] };
  const subtree = useStore().select().from(links).where(inArray(links.issue, subtreeNumbers(effort))).orderBy(asc(links.issue), asc(links.id)).all();
  for (const link of subtree) rollUp(rollup[link.role as LinkRole], link);
  return rollup;
};

export const artifactsMarkdownOf = (effort: number) =>
  linkRollupOf(effort).artifact.map(({ title, url }) => `- [${title}](${url})\n`).join('');

const childrenOf = (parent: number) => useStore().select().from(issues).where(eq(issues.parent, parent)).orderBy(asc(issues.number)).all();

const countByStatus = (children: IssueRecord[]) => {
  const counts: Record<IssueStatus, number> = { open: 0, claimed: 0, blocked: 0, closed: 0 };
  for (const child of children) counts[statusOf(child)] += 1;
  return counts;
};

const triageBuckets = (tickets: IssueRecord[]) => {
  const members = useStore().select({ id: labelGroupMembers.id }).from(labelGroupMembers)
    .where(eq(labelGroupMembers.groupId, 'triage-state')).orderBy(asc(labelGroupMembers.position)).all().map(row => row.id);
  const buckets: Record<string, number> = Object.fromEntries([...members, 'none'].map(id => [id, 0]));
  for (const ticket of tickets) {
    const state = labelsOf(ticket.number).find(label => members.includes(label)) ?? 'none';
    buckets[state] = (buckets[state] ?? 0) + 1;
  }
  return buckets;
};

const openInSubtree = (effort: number) =>
  useStore().select({ number: issues.number }).from(issues)
    .where(and(inArray(issues.number, subtreeNumbers(effort)), ne(issues.number, effort), eq(issues.state, 'open'))).all().length;

export const statusRollupOf = (effort: number): StatusRollup => {
  const children = childrenOf(effort);
  const map = children.find(child => child.kind === 'map') ?? null;
  return {
    map: map ? { state: map.state, frontier: frontierSizeOf(map.number) } : null,
    specs: children.filter(child => child.kind === 'spec').map(spec => ({ number: spec.number, tickets: countByStatus(childrenOf(spec.number)) })),
    triage: triageBuckets(children.filter(child => child.kind === 'ticket')),
    open: openInSubtree(effort),
  };
};
