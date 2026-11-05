import type { H3Event } from 'h3';
import type { JsonObject } from '../../utils/body';
import type { Query } from '../../utils/paging';
import type { IssueCursor, IssueFields, IssueQuery } from '../../utils/issues';
import type { Caller } from '../../utils/caller';
import { toDocument, toRows } from '../representations';
import type { toRow } from '../representations';
import { nullable, stringList } from '../schemas';
import { blockerNumberParam, issueNumberParam, labelParam } from './params';

const parentField = (body: JsonObject) => {
  const value = body.parent;
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw invalid('parent must be an issue number or null', 'parent');
};

const labelsField = (body: JsonObject) => body.labels === undefined ? undefined : stringArray(body, 'labels', { nonBlank: true }).map(label => label.trim());

const blockedByField = (body: JsonObject) => {
  const value = body.blockedBy;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every(number => typeof number === 'number' && Number.isInteger(number) && number > 0)) throw invalid('blockedBy must be an array of issue numbers', 'blockedBy');
  return value;
};

const fieldsFrom = (body: JsonObject): IssueFields => {
  const fields: IssueFields = {};
  if ('title' in body) fields.title = requireString(body, 'title');
  if ('body' in body) fields.body = anyString(body, 'body');
  if ('parent' in body) fields.parent = parentField(body);
  if ('name' in body) fields.name = optionalString(body, 'name');
  if ('testInstructions' in body) fields.testInstructions = optionalString(body, 'testInstructions');
  return fields;
};

const expectedVersionFrom = (event: H3Event) => {
  const header = getRequestHeader(event, 'if-match');
  if (header === undefined) return null;
  const version = Number(header.trim().replace(/^W\//i, '').replace(/^"(.*)"$/, '$1'));
  if (!Number.isInteger(version) || version < 1) throw invalid('If-Match must carry a version number', 'version');
  return version;
};

const issueCreate = async (event: H3Event, caller: Caller) => {
  const body = await readJsonObject(event);
  const kind = requireString(body, 'kind');
  if (!isKind(kind)) throw invalid(`kind must be one of ${KINDS.join(', ')}`, 'kind');
  const fields = fieldsFrom(body);
  const issue = createIssue({ ...fields, kind, title: requireString(body, 'title'), labels: labelsField(body), blockedBy: blockedByField(body) }, caller);
  setResponseStatus(event, 201);
  return toDocument(event, issue);
};

const issueRead = (event: H3Event) => toDocument(event, requireIssue(issueNumberParam(event)));

const issueEdit = async (event: H3Event, caller: Caller) => {
  const number = issueNumberParam(event);
  const expectedVersion = expectedVersionFrom(event);
  const fields = fieldsFrom(await readJsonObject(event));
  return toDocument(event, patchIssue(number, { fields, expectedVersion }, caller));
};

const issueRemove = (event: H3Event, caller: Caller) => {
  deleteIssue(issueNumberParam(event), caller);
  return sendNoContent(event);
};

const issueAppend = async (event: H3Event, caller: Caller) => {
  const number = issueNumberParam(event);
  const body = await readJsonObject(event);
  const request = { section: requireString(body, 'section'), text: requireString(body, 'text') };
  return toDocument(event, appendToIssue(number, request, caller));
};

const issueReplaceSection = async (event: H3Event, caller: Caller) => {
  const number = issueNumberParam(event);
  const expectedVersion = expectedVersionFrom(event);
  const body = await readJsonObject(event);
  const request = { section: requireString(body, 'section'), text: requireString(body, 'text'), expectedVersion };
  return toDocument(event, replaceIssueSection(number, request, caller));
};

const issueClaim = (event: H3Event, caller: Caller) => toDocument(event, claimIssue(issueNumberParam(event), caller));

const issueUnassign = (event: H3Event, caller: Caller) => toDocument(event, unassignIssue(issueNumberParam(event), caller));

const issueClose = async (event: H3Event, caller: Caller) => {
  const number = issueNumberParam(event);
  const body = await readJsonObject(event);
  const comment = body.comment === undefined ? null : requireText(body, 'comment');
  return toDocument(event, closeIssue(number, comment, caller));
};

const issueReopen = (event: H3Event, caller: Caller) => toDocument(event, reopenIssue(issueNumberParam(event), caller));

const labelAdd = (event: H3Event, caller: Caller) => {
  addLabel(issueNumberParam(event), labelParam(event), caller);
  return sendNoContent(event);
};

const labelRemove = (event: H3Event, caller: Caller) => {
  removeLabel(issueNumberParam(event), labelParam(event), caller);
  return sendNoContent(event);
};

const blockerAdd = (event: H3Event, caller: Caller) => {
  addBlocker(issueNumberParam(event), blockerNumberParam(event), caller);
  return sendNoContent(event);
};

const blockerRemove = (event: H3Event, caller: Caller) => {
  removeBlocker(issueNumberParam(event), blockerNumberParam(event), caller);
  return sendNoContent(event);
};

const MAX_NUMBERS = 200;

const numberParam = (query: Query, key: string) => {
  const raw = queryString(query, key);
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) throw invalid(`${key} must be an issue number`, key);
  return Number(raw);
};

const numbersParam = (query: Query) => {
  const raw = queryString(query, 'numbers');
  if (raw === null) return null;
  const parts = raw.split(',');
  if (parts.length > MAX_NUMBERS) throw invalid(`numbers takes at most ${MAX_NUMBERS} issue numbers`, 'numbers');
  if (!parts.every(part => /^\d+$/.test(part))) throw invalid('numbers must be a comma-separated list of issue numbers', 'numbers');
  return [...new Set(parts.map(Number))];
};

const labelsParam = (query: Query) => queryStrings(query, 'label').map((label) => {
  if (label.trim() === '') throw invalid('label must not be blank', 'label');
  return label.trim();
});

const assigneeParam = (query: Query) => {
  const assignee = queryString(query, 'assignee');
  if (assignee === null || assignee === UNASSIGNED) return assignee;
  if (!findHolder(assignee)) throw invalid(`holder ${assignee} does not exist`, 'assignee');
  return assignee;
};

const missingParam = (query: Query) => queryStrings(query, 'missing').map((group) => {
  if (!findLabelGroup(group)) throw invalid(`label group ${group} does not exist`, 'missing');
  return group;
});

const viewParam = (query: Query, caller: Caller) => {
  const view = queryOneOf(query, 'view', ISSUE_VIEWS);
  if (view === 'mine' && caller.slug === null) throw invalid('view mine needs a Token holder', 'view');
  return view;
};

const sortParam = (query: Query) => {
  const sort = queryString(query, 'sort') ?? 'number';
  if (isIssueSort(sort) || findLabelGroup(sort)) return sort;
  throw invalid(`sort must be one of ${ISSUE_SORTS.join(', ')} or a label group id`, 'sort');
};

const isCursorKeyFor = (sort: string, key: unknown) => {
  if (sort === 'number') return typeof key === 'number';
  if (isIssueSort(sort)) return typeof key === 'string';
  return key === null || typeof key === 'number';
};

const sortKeyOf = (sort: string) => {
  if (isIssueSort(sort)) return (row: ReturnType<typeof toRow>) => row[sort];
  return (row: ReturnType<typeof toRow>) => soleMemberPositionAmong(sort, row.labels);
};

const issueList = (event: H3Event, caller: Caller) => {
  const query = getQuery(event);
  const limit = pageLimit(query);
  const sort = sortParam(query);
  const effort = queryString(query, 'effort');
  const request: IssueQuery = {
    kind: queryOneOf(query, 'kind', KINDS),
    state: queryOneOf(query, 'state', ISSUE_STATES),
    parent: numberParam(query, 'parent'),
    effort: effort === null ? null : requireEffort(effort).number,
    numbers: numbersParam(query),
    q: queryString(query, 'q'),
    labels: labelsParam(query),
    assignee: assigneeParam(query),
    missing: missingParam(query),
    view: viewParam(query, caller),
    holder: caller.slug,
    sort,
    order: queryOneOf(query, 'order', SORT_ORDERS) ?? 'asc',
    after: sortCursor<IssueCursor['key']>(query, sort, key => isCursorKeyFor(sort, key)),
    limit: limit + 1,
  };
  const rows = toRows(event, listIssues(request));
  const effortCounts = countIssuesByEffort(request);
  if (request.numbers) return { items: rows, nextCursor: null, effortCounts };
  const keyOf = sortKeyOf(sort);
  return { ...pageOf(rows, limit, row => [sort, keyOf(row), row.number]), effortCounts };
};

const issueChanges = (event: H3Event) => {
  const number = issueNumberParam(event);
  const query = getQuery(event);
  const limit = pageLimit(query);
  const cursor = tupleCursor<[string, number]>(query, [value => typeof value === 'string', value => typeof value === 'number']);
  const rows = listChanges(number, { field: queryString(query, 'field'), after: cursor && { at: cursor[0], id: cursor[1] }, limit: limit + 1 });
  return pageOf(rows, limit, change => [change.at, change.id]);
};

export const issueHandlers = {
  list: issueList,
  create: issueCreate,
  read: issueRead,
  edit: issueEdit,
  remove: issueRemove,
  append: issueAppend,
  replaceSection: issueReplaceSection,
  claim: issueClaim,
  unassign: issueUnassign,
  close: issueClose,
  reopen: issueReopen,
  changes: issueChanges,
  labelAdd,
  labelRemove,
  blockerAdd,
  blockerRemove,
};

const numberList = { type: 'array', items: { type: 'integer' } };

export const ISSUE_FIELDS_SCHEMA = {
  title: { type: 'string' },
  body: { type: 'string' },
  parent: nullable('integer'),
  name: { ...nullable('string'), description: 'Effort only, slug-shaped, unique' },
  testInstructions: { ...nullable('string'), description: 'Effort only' },
};

export const ISSUE_CREATE_SCHEMA = {
  ...ISSUE_FIELDS_SCHEMA,
  labels: { ...stringList, description: 'Applied in order; a label group member removes its siblings' },
  blockedBy: { ...numberList, description: 'Blocker issue numbers; every one must exist' },
};

const queryParam = (name: string, schema: Record<string, unknown>, description: string) => ({ name, in: 'query' as const, schema, description });

export const ISSUE_LIST_PARAMS = [
  queryParam('kind', { type: 'string', enum: KINDS }, 'Only issues of this Kind'),
  queryParam('state', { type: 'string', enum: ISSUE_STATES }, 'Only open or only closed issues'),
  queryParam('parent', { type: 'integer' }, 'Only direct children of this issue'),
  queryParam('effort', { type: 'string' }, 'An Effort slug or number: the Effort and its whole subtree'),
  queryParam('numbers', { type: 'string' }, 'Comma-separated issue numbers, at most 200, returned in the given order regardless of sort; unknown numbers are skipped and the result never pages'),
  queryParam('q', { type: 'string' }, 'Case-insensitive substring over title and body'),
  queryParam('label', stringList, 'Repeatable; only issues carrying every given label, a Label group member or a free-form label'),
  queryParam('assignee', { type: 'string' }, `A holder slug, or ${UNASSIGNED} for unassigned issues`),
  queryParam('missing', stringList, 'Repeatable Label group ids; only issues carrying no member of any given group'),
  queryParam('view', { type: 'string', enum: ISSUE_VIEWS }, 'A Saved view; explicit filters narrow within it. frontier: open, unassigned, no open blocker, Parent is a map. mine: open and held by the caller, refused without a Token holder. needs-triage: open and labelled needs-triage. blocked: open with an open blocker. closed-recent: closed in the last 7 days'),
  queryParam('sort', { type: 'string', default: 'number' }, `One of ${ISSUE_SORTS.join(', ')}, or a Label group id to order by its member order with issues carrying no member last in either order; number breaks ties`),
  queryParam('order', { type: 'string', enum: SORT_ORDERS, default: 'asc' }, 'The sort direction'),
];
