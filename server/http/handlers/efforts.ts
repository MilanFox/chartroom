import type { H3Event } from 'h3';
import type { IssueCursor, IssueRecord } from '../../utils/issues';
import type { Query } from '../../utils/paging';
import { DOCUMENT_SCHEMA, pageSchema, PAGING_PARAMS, ROW_SCHEMA, toDocument, toRow } from './issues';
import { LINK_SCHEMA } from './links';
import { effortHandleParam } from './params';

export const toEffortDocument = (event: H3Event, effort: IssueRecord) => {
  const children = childrenOf(effort.number);
  const map = children.find(child => child.kind === 'map');
  return {
    ...toDocument(event, effort),
    statusRollup: statusRollupOf(effort.number),
    linkRollup: linkRollupOf(effort.number),
    map: map ? toRow(event, map) : null,
    specs: children.filter(child => child.kind === 'spec').map(spec => toRow(event, spec)),
  };
};

const effortCursor = (query: Query, sort: EffortSort): IssueCursor | null => {
  const key = decodeCursor(query);
  if (key === null) return null;
  const [cursorSort, sortKey, number] = key;
  if (cursorSort !== sort || typeof sortKey !== 'string' || typeof number !== 'number') throw invalid('cursor is not valid', 'cursor');
  return { key: sortKey, number };
};

const effortList = (event: H3Event) => {
  const query = getQuery(event);
  const limit = pageLimit(query);
  const sort = queryOneOf(query, 'sort', EFFORT_SORTS) ?? 'updatedAt';
  const order = queryOneOf(query, 'order', SORT_ORDERS) ?? 'asc';
  const rows = listEfforts({ sort, order, after: effortCursor(query, sort), limit: limit + 1 }).map(effort => toEffortDocument(event, effort));
  return pageOf(rows, limit, row => [sort, row[sort], row.number]);
};

const effortRead = (event: H3Event) => toEffortDocument(event, resolveEffort(effortHandleParam(event)));

const effortArtifacts = (event: H3Event) => {
  const effort = resolveEffort(effortHandleParam(event));
  setResponseHeader(event, 'content-type', 'text/markdown; charset=utf-8');
  return artifactsMarkdownOf(effort.number);
};

export const effortHandlers = {
  list: effortList,
  read: effortRead,
  artifacts: effortArtifacts,
};

const countRecord = { type: 'object', additionalProperties: { type: 'integer' } };

const STATUS_ROLLUP_SCHEMA = {
  type: 'object',
  description: 'Computed, never stored',
  properties: {
    map: { oneOf: [{ type: 'object', properties: { state: { type: 'string', enum: ['open', 'closed'] }, frontier: { type: 'integer', description: 'Open, unassigned children of the map with no open blocker' } }, required: ['state', 'frontier'] }, { type: 'null' }] },
    specs: { type: 'array', items: { type: 'object', properties: { number: { type: 'integer' }, tickets: { ...countRecord, description: 'The children of the spec by status' } }, required: ['number', 'tickets'] } },
    triage: { ...countRecord, description: 'Tickets parented straight to the Effort, one bucket per triage-state member plus none' },
    open: { type: 'integer', description: 'Open issues in the subtree, the Effort itself excluded' },
  },
  required: ['map', 'specs', 'triage', 'open'],
};

const ROLLED_UP_LINK_SCHEMA = {
  type: 'object',
  properties: { url: LINK_SCHEMA.properties.url, title: { type: 'string' }, type: LINK_SCHEMA.properties.type, sources: { type: 'array', items: { type: 'integer' }, description: 'Every issue in the subtree carrying the URL' } },
  required: ['url', 'title', 'type', 'sources'],
};

const EFFORT_DOCUMENT_PROPERTIES = {
  ...DOCUMENT_SCHEMA.properties,
  statusRollup: STATUS_ROLLUP_SCHEMA,
  linkRollup: { type: 'object', description: 'Every Link in the subtree, closed tickets included, deduped by URL', properties: { resource: { type: 'array', items: ROLLED_UP_LINK_SCHEMA }, artifact: { type: 'array', items: ROLLED_UP_LINK_SCHEMA } }, required: ['resource', 'artifact'] },
  map: { oneOf: [ROW_SCHEMA, { type: 'null' }] },
  specs: { type: 'array', items: ROW_SCHEMA },
};

export const EFFORT_DOCUMENT_SCHEMA = { type: 'object', properties: EFFORT_DOCUMENT_PROPERTIES, required: [...DOCUMENT_SCHEMA.required, 'name', 'testInstructions', 'statusRollup', 'linkRollup', 'map', 'specs'] };
export const EFFORT_PAGE_SCHEMA = pageSchema(EFFORT_DOCUMENT_SCHEMA);
export const EFFORT_HANDLE_PARAM = { name: 'handle', in: 'path' as const, required: true, schema: { type: 'string' }, description: 'An Effort slug or number' };
export const EFFORT_LIST_PARAMS = [
  { name: 'sort', in: 'query' as const, schema: { type: 'string', enum: EFFORT_SORTS, default: 'updatedAt' }, description: 'The sort key; number breaks ties' },
  { name: 'order', in: 'query' as const, schema: { type: 'string', enum: SORT_ORDERS, default: 'asc' }, description: 'The sort direction' },
  ...PAGING_PARAMS,
];
