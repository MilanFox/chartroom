import type { H3Event } from 'h3';
import type { JsonObject } from '../../utils/body';
import type { Query } from '../../utils/paging';
import type { IssueCursor, IssueFields, IssueQuery, IssueRecord, IssueSort } from '../../utils/issues';
import type { Principal } from '../../utils/principal';
import { COMMENT_SCHEMA, toComment } from './comments';
import { issueNumberParam } from './params';

export const toRow = (event: H3Event, issue: IssueRecord) => ({
  number: issue.number,
  kind: issue.kind,
  title: issue.title,
  state: issue.state,
  status: statusOf(issue),
  assignee: issue.assignee,
  parent: issue.parent,
  effort: effortNumberOf(issue),
  labels: [] as string[],
  createdAt: issue.createdAt,
  updatedAt: issue.updatedAt,
  url: `${baseUrl(event)}/issues/${issue.number}`,
});

export const toDocument = (event: H3Event, issue: IssueRecord) => {
  const resolution = resolutionOf(issue.number);
  return {
    ...toRow(event, issue),
    body: issue.body,
    createdBy: issue.createdBy,
    origin: issue.origin,
    closedAt: issue.closedAt,
    version: issue.version,
    blockedBy: [],
    blocks: [],
    children: childNumbers(issue.number),
    links: [],
    comments: commentsOf(issue.number).map(comment => toComment(event, comment)),
    resolution: resolution === null ? null : toComment(event, resolution),
    ...(issue.kind === 'effort' ? { name: issue.name, testInstructions: issue.testInstructions } : {}),
  };
};

const parentField = (body: JsonObject) => {
  const value = body.parent;
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw invalid('parent must be an issue number or null', 'parent');
};

const textField = (body: JsonObject, field: string) => {
  const value = body[field];
  if (typeof value !== 'string') throw invalid(`${field} must be a string`, field);
  return value;
};

const fieldsFrom = (body: JsonObject): IssueFields => {
  const fields: IssueFields = {};
  if ('title' in body) fields.title = requireString(body, 'title');
  if ('body' in body) fields.body = textField(body, 'body');
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

const issueCreate = async (event: H3Event, principal: Principal) => {
  const body = await readJsonObject(event);
  const kind = requireString(body, 'kind');
  if (!isKind(kind)) throw invalid(`kind must be one of ${KINDS.join(', ')}`, 'kind');
  const fields = fieldsFrom(body);
  const issue = createIssue({ ...fields, kind, title: requireString(body, 'title') }, principal);
  setResponseStatus(event, 201);
  return toDocument(event, issue);
};

const issueRead = (event: H3Event) => toDocument(event, requireIssue(issueNumberParam(event)));

const issueEdit = async (event: H3Event, principal: Principal) => {
  const number = issueNumberParam(event);
  const expectedVersion = expectedVersionFrom(event);
  const fields = fieldsFrom(await readJsonObject(event));
  return toDocument(event, patchIssue(number, { fields, expectedVersion }, principal));
};

const issueRemove = (event: H3Event) => {
  deleteIssue(issueNumberParam(event));
  return sendNoContent(event);
};

const issueAppend = async (event: H3Event, principal: Principal) => {
  const number = issueNumberParam(event);
  const body = await readJsonObject(event);
  const request = { section: requireString(body, 'section'), text: requireString(body, 'text') };
  return toDocument(event, appendToIssue(number, request, principal));
};

const issueClaim = (event: H3Event, principal: Principal) => toDocument(event, claimIssue(issueNumberParam(event), principal));

const issueUnassign = (event: H3Event, principal: Principal) => toDocument(event, unassignIssue(issueNumberParam(event), principal));

const issueClose = async (event: H3Event, principal: Principal) => {
  const number = issueNumberParam(event);
  const body = await readJsonObject(event);
  const comment = body.comment === undefined ? null : requireText(body, 'comment');
  return toDocument(event, closeIssue(number, comment, principal));
};

const issueReopen = (event: H3Event, principal: Principal) => toDocument(event, reopenIssue(issueNumberParam(event), principal));

const MAX_NUMBERS = 200;

const oneOf = <T extends string>(query: Query, key: string, allowed: readonly T[]): T | null => {
  const raw = queryString(query, key);
  if (raw === null) return null;
  if (!allowed.includes(raw as T)) throw invalid(`${key} must be one of ${allowed.join(', ')}`, key);
  return raw as T;
};

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

const issueCursor = (query: Query, sort: IssueSort): IssueCursor | null => {
  const key = decodeCursor(query);
  if (key === null) return null;
  const [cursorSort, sortKey, number] = key;
  const keyType = sort === 'number' ? 'number' : 'string';
  if (cursorSort !== sort || typeof sortKey !== keyType || typeof number !== 'number') throw invalid('cursor is not valid', 'cursor');
  return { key: sortKey as string | number, number };
};

const issueList = (event: H3Event) => {
  const query = getQuery(event);
  const limit = pageLimit(query);
  const sort = oneOf(query, 'sort', ISSUE_SORTS) ?? 'number';
  const effort = queryString(query, 'effort');
  const request: IssueQuery = {
    kind: oneOf(query, 'kind', KINDS),
    state: oneOf(query, 'state', ISSUE_STATES),
    parent: numberParam(query, 'parent'),
    effort: effort === null ? null : requireEffort(effort).number,
    numbers: numbersParam(query),
    q: queryString(query, 'q'),
    sort,
    order: oneOf(query, 'order', SORT_ORDERS) ?? 'asc',
    after: issueCursor(query, sort),
    limit: limit + 1,
  };
  const rows = listIssues(request).map(issue => toRow(event, issue));
  if (request.numbers) return { items: rows, nextCursor: null };
  return pageOf(rows, limit, row => [sort, row[sort], row.number]);
};

const changeCursor = (query: Query) => {
  const key = decodeCursor(query);
  if (key === null) return null;
  const [at, id] = key;
  if (typeof at !== 'string' || typeof id !== 'number') throw invalid('cursor is not valid', 'cursor');
  return { at, id };
};

const issueChanges = (event: H3Event) => {
  const number = issueNumberParam(event);
  const query = getQuery(event);
  const limit = pageLimit(query);
  const rows = listChanges(number, { field: queryString(query, 'field'), after: changeCursor(query), limit: limit + 1 });
  return pageOf(rows, limit, change => [change.at, change.id]);
};

export const issueHandlers = {
  list: issueList,
  create: issueCreate,
  read: issueRead,
  edit: issueEdit,
  remove: issueRemove,
  append: issueAppend,
  claim: issueClaim,
  unassign: issueUnassign,
  close: issueClose,
  reopen: issueReopen,
  changes: issueChanges,
};

const nullable = (type: string) => ({ type: [type, 'null'] });
const stringList = { type: 'array', items: { type: 'string' } };
const objectList = { type: 'array', items: { type: 'object' } };

const ROW_PROPERTIES = {
  number: { type: 'integer' },
  kind: { type: 'string', enum: KINDS },
  title: { type: 'string' },
  state: { type: 'string', enum: ['open', 'closed'] },
  status: { type: 'string', enum: ['open', 'claimed', 'closed'] },
  assignee: nullable('string'),
  parent: nullable('integer'),
  effort: nullable('integer'),
  labels: stringList,
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  url: { type: 'string', format: 'uri' },
};

export const ROW_SCHEMA = { type: 'object', properties: ROW_PROPERTIES, required: Object.keys(ROW_PROPERTIES) };

const DOCUMENT_PROPERTIES = {
  ...ROW_PROPERTIES,
  body: { type: 'string' },
  createdBy: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  closedAt: nullable('string'),
  version: { type: 'integer' },
  blockedBy: objectList,
  blocks: objectList,
  children: { type: 'array', items: { type: 'integer' } },
  links: objectList,
  comments: { type: 'array', items: COMMENT_SCHEMA },
  resolution: { oneOf: [COMMENT_SCHEMA, { type: 'null' }] },
  name: { ...nullable('string'), description: 'Effort only' },
  testInstructions: { ...nullable('string'), description: 'Effort only' },
};

export const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: DOCUMENT_PROPERTIES,
  required: Object.keys(DOCUMENT_PROPERTIES).filter(key => key !== 'name' && key !== 'testInstructions'),
};

const CHANGE_PROPERTIES = {
  id: { type: 'integer' },
  issue: { type: 'integer' },
  actor: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  at: { type: 'string', format: 'date-time' },
  field: { type: 'string' },
  before: nullable('string'),
  after: nullable('string'),
};

export const CHANGE_SCHEMA = { type: 'object', properties: CHANGE_PROPERTIES, required: Object.keys(CHANGE_PROPERTIES) };

export const pageSchema = (item: Record<string, unknown>) => ({
  type: 'object',
  properties: { items: { type: 'array', items: item }, nextCursor: nullable('string') },
  required: ['items', 'nextCursor'],
});

export const ISSUE_FIELDS_SCHEMA = {
  title: { type: 'string' },
  body: { type: 'string' },
  parent: nullable('integer'),
  name: { ...nullable('string'), description: 'Effort only, slug-shaped, unique' },
  testInstructions: { ...nullable('string'), description: 'Effort only' },
};

export const ISSUE_NUMBER_PARAM = { name: 'number', in: 'path' as const, required: true, schema: { type: 'integer' } };

const queryParam = (name: string, schema: Record<string, unknown>, description: string) => ({ name, in: 'query' as const, schema, description });

export const ISSUE_LIST_PARAMS = [
  queryParam('kind', { type: 'string', enum: KINDS }, 'Only issues of this Kind'),
  queryParam('state', { type: 'string', enum: ISSUE_STATES }, 'Only open or only closed issues'),
  queryParam('parent', { type: 'integer' }, 'Only direct children of this issue'),
  queryParam('effort', { type: 'string' }, 'An Effort slug or number: the Effort and its whole subtree'),
  queryParam('numbers', { type: 'string' }, 'Comma-separated issue numbers, at most 200, returned in the given order regardless of sort; unknown numbers are skipped and the result never pages'),
  queryParam('q', { type: 'string' }, 'Case-insensitive substring over title and body'),
  queryParam('sort', { type: 'string', enum: ISSUE_SORTS, default: 'number' }, 'The sort key; number breaks ties'),
  queryParam('order', { type: 'string', enum: SORT_ORDERS, default: 'asc' }, 'The sort direction'),
];

export const PAGING_PARAMS = [
  { name: 'limit', in: 'query' as const, schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
  { name: 'cursor', in: 'query' as const, schema: { type: 'string' }, description: 'The nextCursor of the previous page' },
];
