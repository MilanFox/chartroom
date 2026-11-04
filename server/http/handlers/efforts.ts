import type { H3Event } from 'h3';
import type { IssueCursor } from '../../utils/issues';
import type { Query } from '../../utils/paging';
import { toEffortDocument } from '../representations';
import { PAGING_PARAMS } from '../schemas';
import { effortHandleParam } from './params';

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

export const EFFORT_HANDLE_PARAM = { name: 'handle', in: 'path' as const, required: true, schema: { type: 'string' }, description: 'An Effort slug or number' };
export const EFFORT_LIST_PARAMS = [
  { name: 'sort', in: 'query' as const, schema: { type: 'string', enum: EFFORT_SORTS, default: 'updatedAt' }, description: 'The sort key; number breaks ties' },
  { name: 'order', in: 'query' as const, schema: { type: 'string', enum: SORT_ORDERS, default: 'asc' }, description: 'The sort direction' },
  ...PAGING_PARAMS,
];
