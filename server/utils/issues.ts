import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { changes, issues } from '../db/schema';
import type { BlockerRef } from './blockers';
import type { FieldWrite, LoggedValue } from './changes';
import { conflict, invalid, notFound } from './errors';
import { blockedCondition, mapFrontierCondition } from './frontier';
import type { Principal } from './principal';
import type { Store } from './store';
import type { IssueState, IssueStatus, IssueView, Kind } from '#shared/domain';
import { ISSUE_STATES, ISSUE_VIEWS, KINDS, PARENT_RULES, UNASSIGNED } from '#shared/domain';

export type { IssueState, IssueStatus, IssueView, Kind };
export { ISSUE_STATES, ISSUE_VIEWS, KINDS, PARENT_RULES, UNASSIGNED };

export type IssueRecord = typeof issues.$inferSelect;
export type ChangeRecord = typeof changes.$inferSelect;

export const ISSUE_SORTS: IssueSort[] = ['number', 'createdAt', 'updatedAt', 'title', 'state'];
export const SORT_ORDERS: SortOrder[] = ['asc', 'desc'];

const PARENT_REQUIRED = new Set<Kind>(['map', 'spec']);
const EFFORT_ONLY_FIELDS = ['name', 'testInstructions'] as const;
export const LOWERCASE_SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RECENTLY_CLOSED_SECONDS = 7 * 24 * 60 * 60;
const LOGGED_FIELDS = ['title', 'body', 'parent', 'name', 'testInstructions'] as const;

export interface IssueFields {
  title?: string
  body?: string
  parent?: number | null
  name?: string | null
  testInstructions?: string | null
}

export interface NewIssue extends IssueFields {
  kind: Kind
  title: string
  labels?: string[]
  blockedBy?: number[]
}

export interface PatchRequest {
  fields: IssueFields
  expectedVersion?: number | null
}

export interface AppendRequest {
  section: string
  text: string
}

export interface ChangeQuery {
  field?: string | null
  after?: { at: string, id: number } | null
  limit: number
}

export type IssueSort = 'number' | 'createdAt' | 'updatedAt' | 'title' | 'state';
export type SortOrder = 'asc' | 'desc';

export interface IssueCursor {
  key: string | number | null
  number: number
}

export interface IssueQuery {
  kind?: Kind | null
  state?: IssueState | null
  parent?: number | null
  effort?: number | null
  numbers?: number[] | null
  q?: string | null
  labels?: string[] | null
  assignee?: string | null
  missing?: string[] | null
  view?: IssueView | null
  holder?: string | null
  sort: string
  order: SortOrder
  after?: IssueCursor | null
  limit: number
}

const isSet = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

export const isIssueSort = (value: string): value is IssueSort => ISSUE_SORTS.includes(value as IssueSort);

export const isKind = (value: unknown): value is Kind => KINDS.includes(value as Kind);

export const statusOf = (issue: IssueRecord, blockers: BlockerRef[] = blockersOf(issue.number)): IssueStatus => {
  if (issue.state === 'closed') return 'closed';
  if (blockers.some(blocker => blocker.open)) return 'blocked';
  return issue.assignee === null ? 'open' : 'claimed';
};

export const findIssue = (number: number): IssueRecord | null =>
  useStore().select().from(issues).where(eq(issues.number, number)).get() ?? null;

export const requireIssue = (number: number) => {
  const issue = findIssue(number);
  if (!issue) throw notFound(`issue #${number} does not exist`);
  return issue;
};

export const touchIssue = (tx: Store, number: number, at: string) => {
  tx.update(issues).set({ updatedAt: at }).where(eq(issues.number, number)).run();
};

export const childrenOf = (parent: number): IssueRecord[] =>
  useStore().select().from(issues).where(eq(issues.parent, parent)).orderBy(asc(issues.number)).all();

export const childNumbers = (number: number) => childrenOf(number).map(child => child.number);

export const effortNumberOf = (issue: IssueRecord): number | null => effortsByIssue([issue.number]).get(issue.number) ?? null;

export const subtreeNumbers = (root: number) => {
  const numbers = [root];
  let frontier = [root];
  while (frontier.length > 0) {
    frontier = useStore().select({ number: issues.number }).from(issues).where(inArray(issues.parent, frontier)).all().map(row => row.number);
    numbers.push(...frontier);
  }
  return numbers;
};

export const findByHandle = (handle: string): IssueRecord | null =>
  /^\d+$/.test(handle) ? findIssue(Number(handle)) : useStore().select().from(issues).where(eq(issues.name, handle)).get() ?? null;

export const requireEffort = (reference: string): IssueRecord => {
  const effort = findByHandle(reference);
  if (!effort || effort.kind !== 'effort') throw invalid(`effort ${reference} does not exist`, 'effort');
  return effort;
};

const SORT_COLUMNS = {
  number: issues.number,
  createdAt: issues.createdAt,
  updatedAt: issues.updatedAt,
  title: issues.title,
  state: issues.state,
};

const containsText = (needle: string) =>
  sql`(instr(lower(${issues.title}), lower(${needle})) > 0 or instr(lower(${issues.body}), lower(${needle})) > 0)`;

export const beyondCursorOn = (column: SQLiteColumn, order: SortOrder, after: IssueCursor) => {
  const beyond = order === 'asc' ? gt : lt;
  return or(beyond(column, String(after.key)), and(eq(column, String(after.key)), beyond(issues.number, after.number)))!;
};

const beyondMemberCursor = (position: SQL, order: SortOrder, after: IssueCursor) => {
  const beyond = order === 'asc' ? gt : lt;
  const beyondNumber = beyond(issues.number, after.number);
  if (after.key === null) return and(isNull(position), beyondNumber)!;
  return or(beyond(position, after.key), and(eq(position, after.key), beyondNumber), isNull(position))!;
};

const beyondCursor = ({ sort, order, after }: IssueQuery & { after: IssueCursor }) => {
  if (sort === 'number') return (order === 'asc' ? gt : lt)(issues.number, after.number);
  if (isIssueSort(sort)) return beyondCursorOn(SORT_COLUMNS[sort], order, after);
  return beyondMemberCursor(soleMemberPositionOnIssue(sort), order, after);
};

const sortOrdering = ({ sort, order }: IssueQuery) => {
  const direction = order === 'asc' ? asc : desc;
  if (isIssueSort(sort)) return [direction(SORT_COLUMNS[sort]), direction(issues.number)];
  const position = soleMemberPositionOnIssue(sort);
  return [isNull(position), direction(position), direction(issues.number)];
};

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
const VIEW_CONDITIONS: Record<IssueView, (query: IssueQuery) => SQL> = {
  'frontier': mapFrontierCondition,
  'mine': query => and(eq(issues.state, 'open'), eq(issues.assignee, query.holder!))!,
  'needs-triage': () => and(eq(issues.state, 'open'), inArray(issues.number, issuesLabelled('needs-triage')))!,
  'blocked': blockedCondition,
  'closed-recent': () => and(eq(issues.state, 'closed'), gte(issues.closedAt, isoAfterSeconds(-RECENTLY_CLOSED_SECONDS)))!,
};

const filterConditions = (query: IssueQuery) => {
  const conditions: SQL[] = [];
  if (isSet(query.view)) conditions.push(VIEW_CONDITIONS[query.view](query));
  if (isSet(query.kind)) conditions.push(eq(issues.kind, query.kind));
  if (isSet(query.state)) conditions.push(eq(issues.state, query.state));
  if (isSet(query.parent)) conditions.push(eq(issues.parent, query.parent));
  if (isSet(query.effort)) conditions.push(inArray(issues.number, subtreeNumbers(query.effort)));
  if (isSet(query.numbers)) conditions.push(inArray(issues.number, query.numbers));
  if (isSet(query.q) && query.q !== '') conditions.push(containsText(query.q));
  for (const label of query.labels ?? []) conditions.push(inArray(issues.number, issuesLabelled(label)));
  if (isSet(query.assignee)) conditions.push(query.assignee === UNASSIGNED ? isNull(issues.assignee) : eq(issues.assignee, query.assignee));
  for (const group of query.missing ?? []) conditions.push(notInArray(issues.number, issuesInGroup(group)));
  return conditions;
};

export const listIssues = (query: IssueQuery): IssueRecord[] => {
  const conditions = filterConditions(query);
  if (isSet(query.numbers)) {
    const found = new Map(useStore().select().from(issues).where(and(...conditions)).all().map(issue => [issue.number, issue]));
    return query.numbers.map(number => found.get(number)).filter(isSet);
  }
  if (isSet(query.after)) conditions.push(beyondCursor({ ...query, after: query.after }));
  return useStore().select().from(issues).where(and(...conditions)).orderBy(...sortOrdering(query)).limit(query.limit).all();
};

const parentIssues = alias(issues, 'parent_issues');
const grandparentIssues = alias(issues, 'grandparent_issues');

// Parent rules cap the chain at ticket → map or spec → Effort, so two joins always reach the Effort.
const effortAboveIssue = sql<number | null>`case
  when ${parentIssues.kind} = 'effort' then ${parentIssues.number}
  when ${grandparentIssues.kind} = 'effort' then ${grandparentIssues.number}
end`;

const effortOfIssue = sql<number | null>`case when ${issues.kind} = 'effort' then ${issues.number} else ${effortAboveIssue} end`;

export const effortsByIssue = (numbers: number[]) =>
  new Map(useStore().select({ number: issues.number, effort: effortAboveIssue }).from(issues)
    .leftJoin(parentIssues, eq(parentIssues.number, issues.parent))
    .leftJoin(grandparentIssues, eq(grandparentIssues.number, parentIssues.parent))
    .where(inArray(issues.number, numbers)).all().map(row => [row.number, row.effort]));

export const countIssuesByEffort = (query: IssueQuery) =>
  useStore().select({ effort: effortOfIssue, count: count() }).from(issues)
    .leftJoin(parentIssues, eq(parentIssues.number, issues.parent))
    .leftJoin(grandparentIssues, eq(grandparentIssues.number, parentIssues.parent))
    .where(and(...filterConditions(query)))
    .groupBy(effortOfIssue).orderBy(effortOfIssue).all();

const assertSingleMap = (effort: number, self: number | null) => {
  const existing = useStore().select({ number: issues.number }).from(issues)
    .where(and(eq(issues.parent, effort), eq(issues.kind, 'map'))).get();
  if (existing && existing.number !== self) throw conflict(`Effort #${effort} already has map #${existing.number}`, 'parent');
};

export const assertParentAllowed = (kind: Kind, parent: number | null, self: number | null) => {
  if (kind === 'effort' && parent !== null) throw invalid('an Effort takes no parent', 'parent');
  if (parent === null) {
    if (PARENT_REQUIRED.has(kind)) throw invalid(`a ${kind} needs an Effort as parent`, 'parent');
    return;
  }
  const target = findIssue(parent);
  if (!target) throw notFound(`parent #${parent} does not exist`);
  if (!PARENT_RULES[kind].includes(target.kind as Kind)) throw invalid(`a ${kind} cannot be parented to a ${target.kind}`, 'parent');
  if (kind === 'map') assertSingleMap(parent, self);
};

const assertEffortOnlyFields = (kind: Kind, fields: IssueFields) => {
  for (const field of EFFORT_ONLY_FIELDS) {
    if (isSet(fields[field]) && kind !== 'effort') throw invalid(`${field} is only set on an Effort`, field);
  }
};

const assertNameFree = (name: string | null | undefined, self: number | null) => {
  if (!isSet(name)) return;
  if (!LOWERCASE_SLUG_SHAPE.test(name)) throw invalid('name must be a lowercase slug', 'name');
  const existing = useStore().select({ number: issues.number }).from(issues).where(eq(issues.name, name)).get();
  if (existing && existing.number !== self) throw conflict(`name ${name} is taken by #${existing.number}`, 'name');
};

const describeLastWrite = (issue: IssueRecord) => {
  const last = useStore().select().from(changes).where(eq(changes.issue, issue.number)).orderBy(desc(changes.id)).get();
  return last ? { lastWrittenBy: last.actor, lastWrittenAt: last.at } : { lastWrittenBy: issue.createdBy, lastWrittenAt: issue.createdAt };
};

export const createIssue = (input: NewIssue, principal: Principal) => {
  const parent = input.parent ?? null;
  assertEffortOnlyFields(input.kind, input);
  assertParentAllowed(input.kind, parent, null);
  assertNameFree(input.name, null);
  requireBlockers(input.blockedBy ?? []);
  const { actor, origin, at } = stampFor(principal);
  const number = useStore().transaction((tx) => {
    const created = tx.insert(issues).values({
      kind: input.kind,
      title: input.title,
      body: input.body ?? '',
      parent,
      name: input.name ?? null,
      testInstructions: input.testInstructions ?? null,
      createdBy: actor,
      origin,
      createdAt: at,
      updatedAt: at,
    }).returning({ number: issues.number }).get();
    for (const label of input.labels ?? []) applyLabel(tx, created.number, label);
    insertBlockers(tx, created.number, input.blockedBy ?? []);
    return created.number;
  });
  return requireIssue(number);
};

const pendingWrites = (issue: IssueRecord, fields: IssueFields): FieldWrite[] =>
  LOGGED_FIELDS
    .filter(field => fields[field] !== undefined && fields[field] !== issue[field])
    .map(field => ({ field, before: issue[field], after: fields[field] as LoggedValue }));

export const patchIssue = (number: number, { fields, expectedVersion }: PatchRequest, principal: Principal) => {
  const issue = requireIssue(number);
  if (isSet(expectedVersion) && expectedVersion !== issue.version) {
    const { lastWrittenBy, lastWrittenAt } = describeLastWrite(issue);
    throw conflict(`issue #${number} is at version ${issue.version}, last written by ${lastWrittenBy} at ${lastWrittenAt}`, 'version', { version: issue.version, lastWrittenBy, lastWrittenAt });
  }
  const kind = issue.kind as Kind;
  assertEffortOnlyFields(kind, fields);
  if (fields.parent !== undefined) assertParentAllowed(kind, fields.parent, number);
  if (fields.name !== undefined) assertNameFree(fields.name, number);
  const writes = pendingWrites(issue, fields);
  if (writes.length === 0) return issue;
  const stamp = stampFor(principal);
  useStore().transaction((tx) => {
    const values = Object.fromEntries(writes.map(write => [write.field, write.after]));
    tx.update(issues).set({ ...values, updatedAt: stamp.at, version: issue.version + 1 }).where(eq(issues.number, number)).run();
    logChanges(tx, { ...stamp, issue: number }, writes);
  });
  return requireIssue(number);
};

const writeField = (number: number, write: FieldWrite, principal: Principal) => {
  recordIssueWrite(number, principal, (tx) => {
    tx.update(issues).set({ [write.field]: write.after }).where(eq(issues.number, number)).run();
    return [write];
  });
  return requireIssue(number);
};

export const claimIssue = (number: number, principal: Principal) => {
  const issue = requireIssue(number);
  const actor = actorSlug(principal);
  if (issue.state === 'closed') throw invalid(`issue #${number} is closed`, 'state');
  if (issue.assignee === actor) return issue;
  if (issue.assignee !== null) throw conflict(`issue #${number} is held by ${issue.assignee}`, 'assignee', { assignee: issue.assignee });
  return writeField(number, { field: 'assignee', before: null, after: actor }, principal);
};

export const unassignIssue = (number: number, principal: Principal) => {
  const issue = requireIssue(number);
  if (issue.assignee === null) return issue;
  return writeField(number, { field: 'assignee', before: issue.assignee, after: null }, principal);
};

export const closeIssue = (number: number, comment: string | null, principal: Principal) => {
  if (requireIssue(number).state === 'closed') throw invalid(`issue #${number} is already closed`, 'state');
  recordIssueWrite(number, principal, (tx, stamp) => {
    if (comment !== null) insertComment(tx, { issue: number, body: comment, at: stamp.at, resolution: true }, principal);
    tx.update(issues).set({ state: 'closed', closedAt: stamp.at }).where(eq(issues.number, number)).run();
    return [{ field: 'state', before: 'open', after: 'closed' }];
  });
  return requireIssue(number);
};

export const reopenIssue = (number: number, principal: Principal) => {
  const issue = requireIssue(number);
  if (issue.state === 'open') return issue;
  return writeField(number, { field: 'state', before: 'closed', after: 'open' }, principal);
};

export const appendToIssue = (number: number, { section, text }: AppendRequest, principal: Principal) => {
  const issue = requireIssue(number);
  const body = insertUnderSection(issue.body, section, text);
  recordIssueWrite(number, principal, (tx) => {
    tx.update(issues).set({ body, version: issue.version + 1 }).where(eq(issues.number, number)).run();
    return [{ field: 'body', before: issue.body, after: body }];
  });
  return requireIssue(number);
};

export const deleteIssue = (number: number, principal: Principal) => {
  const issue = requireIssue(number);
  const { children } = useStore().select({ children: count() }).from(issues).where(eq(issues.parent, number)).get()!;
  if (children > 0) throw conflict(`issue #${number} still has ${children} ${children === 1 ? 'child' : 'children'}`);
  const stamp = stampFor(principal);
  useStore().transaction((tx) => {
    const blocked = blocksOf(number);
    tx.delete(issues).where(eq(issues.number, number)).run();
    for (const target of blocked) {
      recordWrites(tx, { ...stamp, issue: target.number }, [{ field: 'blocker', before: `#${number} ${issue.title}`, after: null }]);
    }
  });
};

export const listChanges = (number: number, { field, after, limit }: ChangeQuery): ChangeRecord[] => {
  requireIssue(number);
  const conditions = [eq(changes.issue, number)];
  if (field) conditions.push(eq(changes.field, field));
  if (after) conditions.push(or(gt(changes.at, after.at), and(eq(changes.at, after.at), gt(changes.id, after.id)))!);
  return useStore().select().from(changes).where(and(...conditions)).orderBy(asc(changes.at), asc(changes.id)).limit(limit).all();
};
