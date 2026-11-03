import { and, asc, count, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { changes, issues } from '../db/schema';
import type { Principal } from './principal';
import type { Store } from './store';

export type Kind = 'effort' | 'map' | 'spec' | 'ticket';
export type IssueRecord = typeof issues.$inferSelect;
export type ChangeRecord = typeof changes.$inferSelect;

export const KINDS: Kind[] = ['effort', 'map', 'spec', 'ticket'];
export const ISSUE_STATES: IssueState[] = ['open', 'closed'];
export const ISSUE_SORTS: IssueSort[] = ['number', 'createdAt', 'updatedAt', 'title'];
export const SORT_ORDERS: SortOrder[] = ['asc', 'desc'];

export const PARENT_RULES: Record<Kind, Kind[]> = {
  effort: [],
  map: ['effort'],
  spec: ['effort'],
  ticket: ['map', 'spec', 'effort'],
};

const PARENT_REQUIRED = new Set<Kind>(['map', 'spec']);
const EFFORT_ONLY_FIELDS = ['name', 'testInstructions'] as const;
const EFFORT_NAME_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LOGGED_FIELDS = ['title', 'body', 'parent', 'name', 'testInstructions'] as const;

type LoggedField = typeof LOGGED_FIELDS[number];
type LoggedValue = string | number | null;

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

export type IssueState = 'open' | 'closed';
export type IssueSort = 'number' | 'createdAt' | 'updatedAt' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface IssueCursor {
  key: string | number
  number: number
}

export interface IssueQuery {
  kind?: Kind | null
  state?: IssueState | null
  parent?: number | null
  effort?: number | null
  numbers?: number[] | null
  q?: string | null
  sort: IssueSort
  order: SortOrder
  after?: IssueCursor | null
  limit: number
}

interface WriteStamp {
  actor: string
  origin: Principal['origin']
  at: string
}

interface ChangeContext extends WriteStamp {
  issue: number
}

interface FieldWrite {
  field: LoggedField
  before: LoggedValue
  after: LoggedValue
}

const isSet = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

export const isKind = (value: unknown): value is Kind => KINDS.includes(value as Kind);

export const findIssue = (number: number): IssueRecord | null =>
  useStore().select().from(issues).where(eq(issues.number, number)).get() ?? null;

export const requireIssue = (number: number) => {
  const issue = findIssue(number);
  if (!issue) throw notFound(`issue #${number} does not exist`);
  return issue;
};

export const childNumbers = (number: number) =>
  useStore().select({ number: issues.number }).from(issues).where(eq(issues.parent, number)).orderBy(asc(issues.number)).all()
    .map(row => row.number);

export const effortNumberOf = (issue: IssueRecord): number | null => {
  let ancestor = issue.parent === null ? null : findIssue(issue.parent);
  while (ancestor && ancestor.kind !== 'effort') ancestor = ancestor.parent === null ? null : findIssue(ancestor.parent);
  return ancestor?.number ?? null;
};

export const subtreeNumbers = (root: number) => {
  const numbers = [root];
  let frontier = [root];
  while (frontier.length > 0) {
    frontier = useStore().select({ number: issues.number }).from(issues).where(inArray(issues.parent, frontier)).all().map(row => row.number);
    numbers.push(...frontier);
  }
  return numbers;
};

export const requireEffort = (reference: string): IssueRecord => {
  const effort = /^\d+$/.test(reference)
    ? findIssue(Number(reference))
    : useStore().select().from(issues).where(eq(issues.name, reference)).get() ?? null;
  if (!effort || effort.kind !== 'effort') throw invalid(`effort ${reference} does not exist`, 'effort');
  return effort;
};

const SORT_COLUMNS = {
  number: issues.number,
  createdAt: issues.createdAt,
  updatedAt: issues.updatedAt,
  title: issues.title,
};

const containsText = (needle: string) =>
  sql`(instr(lower(${issues.title}), lower(${needle})) > 0 or instr(lower(${issues.body}), lower(${needle})) > 0)`;

const beyondCursor = ({ sort, order, after }: IssueQuery & { after: IssueCursor }) => {
  const beyond = order === 'asc' ? gt : lt;
  if (sort === 'number') return beyond(issues.number, after.number);
  const column = SORT_COLUMNS[sort];
  return or(beyond(column, String(after.key)), and(eq(column, String(after.key)), beyond(issues.number, after.number)))!;
};

const filterConditions = (query: IssueQuery) => {
  const conditions: SQL[] = [];
  if (isSet(query.kind)) conditions.push(eq(issues.kind, query.kind));
  if (isSet(query.state)) conditions.push(eq(issues.state, query.state));
  if (isSet(query.parent)) conditions.push(eq(issues.parent, query.parent));
  if (isSet(query.effort)) conditions.push(inArray(issues.number, subtreeNumbers(query.effort)));
  if (isSet(query.numbers)) conditions.push(inArray(issues.number, query.numbers));
  if (isSet(query.q) && query.q !== '') conditions.push(containsText(query.q));
  return conditions;
};

export const listIssues = (query: IssueQuery): IssueRecord[] => {
  const conditions = filterConditions(query);
  if (isSet(query.numbers)) {
    const found = new Map(useStore().select().from(issues).where(and(...conditions)).all().map(issue => [issue.number, issue]));
    return query.numbers.map(number => found.get(number)).filter(isSet);
  }
  if (isSet(query.after)) conditions.push(beyondCursor({ ...query, after: query.after }));
  const direction = query.order === 'asc' ? asc : desc;
  return useStore().select().from(issues).where(and(...conditions))
    .orderBy(direction(SORT_COLUMNS[query.sort]), direction(issues.number)).limit(query.limit).all();
};

const assertSingleMap = (effort: number, self: number | null) => {
  const existing = useStore().select({ number: issues.number }).from(issues)
    .where(and(eq(issues.parent, effort), eq(issues.kind, 'map'))).get();
  if (existing && existing.number !== self) throw conflict(`Effort #${effort} already has map #${existing.number}`, 'parent');
};

const assertParentAllowed = (kind: Kind, parent: number | null, self: number | null) => {
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
  if (!EFFORT_NAME_SHAPE.test(name)) throw invalid('name must be a lowercase slug', 'name');
  const existing = useStore().select({ number: issues.number }).from(issues).where(eq(issues.name, name)).get();
  if (existing && existing.number !== self) throw conflict(`name ${name} is taken by #${existing.number}`, 'name');
};

const stampFor = (principal: Principal): WriteStamp => ({ actor: actorSlug(principal), origin: principal.origin, at: nowIso() });

const asLogged = (value: LoggedValue) => (value === null ? null : String(value));

const logChanges = (tx: Store, context: ChangeContext, writes: FieldWrite[]) => {
  tx.insert(changes).values(writes.map(write => ({
    issue: context.issue,
    actor: context.actor,
    origin: context.origin,
    at: context.at,
    field: write.field,
    before: asLogged(write.before),
    after: asLogged(write.after),
  }))).run();
};

const describeLastWrite = (issue: IssueRecord) => {
  const last = useStore().select().from(changes).where(eq(changes.issue, issue.number)).orderBy(desc(changes.id)).get();
  return last ? `${last.actor} at ${last.at}` : `${issue.createdBy} at ${issue.createdAt}`;
};

export const createIssue = (input: NewIssue, principal: Principal) => {
  const parent = input.parent ?? null;
  assertEffortOnlyFields(input.kind, input);
  assertParentAllowed(input.kind, parent, null);
  assertNameFree(input.name, null);
  const { actor, origin, at } = stampFor(principal);
  const { number } = useStore().insert(issues).values({
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
  return requireIssue(number);
};

const pendingWrites = (issue: IssueRecord, fields: IssueFields): FieldWrite[] =>
  LOGGED_FIELDS
    .filter(field => fields[field] !== undefined && fields[field] !== issue[field])
    .map(field => ({ field, before: issue[field], after: fields[field] as LoggedValue }));

export const patchIssue = (number: number, { fields, expectedVersion }: PatchRequest, principal: Principal) => {
  const issue = requireIssue(number);
  if (isSet(expectedVersion) && expectedVersion !== issue.version) {
    throw conflict(`issue #${number} is at version ${issue.version}, last written by ${describeLastWrite(issue)}`, 'version');
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

const HEADING = /^(#{1,6})\s+(.*)$/;

const headingOf = (line: string) => {
  const match = HEADING.exec(line);
  return match ? { level: match[1]!.length, text: match[2]!.trim() } : null;
};

export const insertUnderSection = (body: string, section: string, text: string) => {
  const lines = body.split('\n');
  const wanted = section.trim();
  const start = lines.findIndex(line => headingOf(line)?.text === wanted);
  if (start === -1) throw invalid(`section ${section} does not exist`, 'section');
  const { level } = headingOf(lines[start]!)!;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const heading = headingOf(lines[index]!);
    if (heading && heading.level <= level) {
      end = index;
      break;
    }
  }
  let last = start;
  for (let index = end - 1; index > start; index -= 1) {
    if (lines[index]!.trim() !== '') {
      last = index;
      break;
    }
  }
  return [...lines.slice(0, last + 1), ...text.trimEnd().split('\n'), ...lines.slice(last + 1)].join('\n');
};

export const appendToIssue = (number: number, { section, text }: AppendRequest, principal: Principal) =>
  useStore().transaction((tx) => {
    const issue = requireIssue(number);
    const body = insertUnderSection(issue.body, section, text);
    const stamp = stampFor(principal);
    tx.update(issues).set({ body, updatedAt: stamp.at, version: issue.version + 1 }).where(eq(issues.number, number)).run();
    logChanges(tx, { ...stamp, issue: number }, [{ field: 'body', before: issue.body, after: body }]);
    return requireIssue(number);
  });

export const deleteIssue = (number: number) => {
  requireIssue(number);
  const { children } = useStore().select({ children: count() }).from(issues).where(eq(issues.parent, number)).get()!;
  if (children > 0) throw conflict(`issue #${number} still has ${children} ${children === 1 ? 'child' : 'children'}`);
  useStore().delete(issues).where(eq(issues.number, number)).run();
};

export const listChanges = (number: number, { field, after, limit }: ChangeQuery): ChangeRecord[] => {
  requireIssue(number);
  const conditions = [eq(changes.issue, number)];
  if (field) conditions.push(eq(changes.field, field));
  if (after) conditions.push(or(gt(changes.at, after.at), and(eq(changes.at, after.at), gt(changes.id, after.id)))!);
  return useStore().select().from(changes).where(and(...conditions)).orderBy(asc(changes.at), asc(changes.id)).limit(limit).all();
};
