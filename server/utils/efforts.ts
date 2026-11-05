import { and, asc, count, desc, eq, inArray, max, ne, notInArray, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { changes, comments, issueBlockers, issues, links, researchNotes } from '../db/schema';
import type { Caller } from './caller';
import type { IssueCursor, IssueRecord, IssueState, IssueStatus, SortOrder } from './issues';
import type { LinkRecord, LinkRole, LinkType } from './links';
import type { ResearchNoteRecord } from './research-notes';
import type { ClosedEffort, EffortContents, EffortDeletion } from '#shared/api';

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

export type RolledUpNoteRecord = Pick<ResearchNoteRecord, 'slug' | 'title' | 'size' | 'updatedAt'> & { issue: Pick<IssueRecord, 'number' | 'title' | 'kind'> };

export interface StatusRollup {
  map: { state: IssueState, frontier: number } | null
  specs: { number: number, tickets: Record<IssueStatus, number>, frontier: number }[]
  triage: Record<string, number>
  open: number
}

const SORT_COLUMNS = { updatedAt: issues.updatedAt, name: issues.name };

export const resolveEffort = (slugOrNumber: string): IssueRecord => {
  const issue = findBySlugOrNumber(slugOrNumber);
  if (!issue) throw notFound(`effort ${slugOrNumber} does not exist`);
  if (issue.kind !== 'effort') throw invalid(`issue #${issue.number} is a ${issue.kind}, not an Effort`, 'handle');
  return issue;
};

export const listEfforts = ({ sort, order, after, limit }: EffortQuery): IssueRecord[] => {
  const column = SORT_COLUMNS[sort];
  const conditions = [eq(issues.kind, 'effort')];
  if (after) conditions.push(beyondCursorOn(column, order, after));
  const direction = order === 'asc' ? asc : desc;
  return useStore().select().from(issues).where(and(...conditions)).orderBy(direction(column), direction(issues.number)).limit(limit).all();
};

const mergeIntoRollup = (bucket: RolledUpLink[], link: LinkRecord) => {
  const existing = bucket.find(entry => entry.url === link.url);
  if (existing) existing.sources.push(link.issue);
  else bucket.push({ url: link.url, title: link.title, type: link.type as LinkType, sources: [link.issue] });
};

export const linkRollupOf = (effort: number): LinkRollup => {
  const rollup: LinkRollup = { resource: [], artifact: [] };
  const subtree = useStore().select().from(links).where(inArray(links.issue, subtreeNumbers(effort))).orderBy(asc(links.issue), asc(links.id)).all();
  for (const link of subtree) mergeIntoRollup(rollup[link.role as LinkRole], link);
  return rollup;
};

export const researchRollupOf = (effort: number): RolledUpNoteRecord[] =>
  useStore()
    .select({ slug: researchNotes.slug, title: researchNotes.title, size: researchNotes.size, updatedAt: researchNotes.updatedAt, issue: { number: issues.number, title: issues.title, kind: issues.kind } })
    .from(researchNotes)
    .innerJoin(issues, eq(researchNotes.issue, issues.number))
    .where(inArray(researchNotes.issue, subtreeNumbers(effort)))
    .orderBy(desc(researchNotes.updatedAt), desc(researchNotes.id))
    .all();

export const artifactsMarkdownOf = (effort: number) =>
  linkRollupOf(effort).artifact.map(({ title, url }) => `- [${title}](${url})\n`).join('');

const countByStatus = (children: IssueRecord[]) => {
  const counts: Record<IssueStatus, number> = { open: 0, claimed: 0, blocked: 0, closed: 0 };
  for (const child of children) counts[statusOf(child)] += 1;
  return counts;
};

const triageBuckets = (tickets: IssueRecord[]) => {
  const members = triageMemberIds();
  const labels = labelsByIssue(tickets.map(ticket => ticket.number));
  const buckets: Record<string, number> = Object.fromEntries([...members, 'none'].map(id => [id, 0]));
  for (const ticket of tickets) {
    const state = (labels.get(ticket.number) ?? []).find(label => members.includes(label)) ?? 'none';
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
    map: map ? { state: map.state as IssueState, frontier: frontierSizeOf(map.number) } : null,
    specs: children.filter(child => child.kind === 'spec').map(spec => ({ number: spec.number, tickets: countByStatus(childrenOf(spec.number)), frontier: frontierSizeOf(spec.number) })),
    triage: triageBuckets(children.filter(child => child.kind === 'ticket')),
    open: openInSubtree(effort),
  };
};

const countIn = (table: SQLiteTable, column: SQLiteColumn, subtree: number[]) =>
  useStore().select({ total: count() }).from(table).where(inArray(column, subtree)).get()!.total;

const contentsOf = (subtree: number[]): EffortContents => ({
  issues: subtree.length - 1,
  comments: countIn(comments, comments.issue, subtree),
  links: countIn(links, links.issue, subtree),
  changes: countIn(changes, changes.issue, subtree),
  researchNotes: countIn(researchNotes, researchNotes.issue, subtree),
});

const lastActivityOf = (subtree: number[]) => {
  const store = useStore();
  const latest = [
    store.select({ at: max(issues.updatedAt) }).from(issues).where(inArray(issues.number, subtree)).get()?.at,
    store.select({ at: max(comments.updatedAt) }).from(comments).where(inArray(comments.issue, subtree)).get()?.at,
    store.select({ at: max(changes.at) }).from(changes).where(inArray(changes.issue, subtree)).get()?.at,
    store.select({ at: max(researchNotes.updatedAt) }).from(researchNotes).where(inArray(researchNotes.issue, subtree)).get()?.at,
  ];
  return latest.filter(at => typeof at === 'string').sort().at(-1)!;
};

export const listClosedEfforts = (): ClosedEffort[] =>
  useStore().select().from(issues).where(and(eq(issues.kind, 'effort'), eq(issues.state, 'closed'))).all()
    .map((effort) => {
      const subtree = subtreeNumbers(effort.number);
      return { number: effort.number, name: effort.name, title: effort.title, closedAt: effort.closedAt, lastActivityAt: lastActivityOf(subtree), counts: contentsOf(subtree) };
    })
    .sort((first, second) => first.lastActivityAt.localeCompare(second.lastActivityAt) || first.number - second.number);

const snapshotBeforeDeleting = (effort: IssueRecord) => {
  try {
    return takeSnapshot(useStore(), useDeploymentConfig().dataDir, preDeleteStem(effort.name ?? String(effort.number)));
  }
  catch (error) {
    throw internalError(`Snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const vacuumStore = () => {
  try {
    useStore().run(sql`VACUUM`);
    useStore().run(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
    return true;
  }
  catch {
    return false;
  }
};

export const deleteEffort = (slugOrNumber: string, caller: Caller): EffortDeletion => {
  const effort = resolveEffort(slugOrNumber);
  if (effort.state !== 'closed') throw conflict(`effort #${effort.number} is open; close the Effort first`, 'state');
  const subtree = subtreeNumbers(effort.number);
  const deleted = contentsOf(subtree);
  const snapshot = snapshotBeforeDeleting(effort);
  const stamp = stampFor(caller);
  useStore().transaction((tx) => {
    const blockedOutside = tx.select({ issue: issueBlockers.issue, blocker: issues.number, title: issues.title }).from(issueBlockers)
      .innerJoin(issues, eq(issues.number, issueBlockers.blocker))
      .where(and(inArray(issueBlockers.blocker, subtree), notInArray(issueBlockers.issue, subtree))).all();
    tx.delete(issues).where(inArray(issues.number, subtree)).run();
    for (const { issue, blocker, title } of blockedOutside) {
      recordWrites(tx, { ...stamp, issue }, [{ field: 'blocker', before: `#${blocker} ${title}`, after: null }]);
    }
  });
  return { snapshot, deleted, vacuumed: vacuumStore() };
};
