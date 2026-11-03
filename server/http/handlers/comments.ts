import type { H3Event } from 'h3';
import type { CommentRecord } from '../../utils/comments';
import type { Query } from '../../utils/paging';
import type { Principal } from '../../utils/principal';
import { commentIdParam, issueNumberParam } from './params';

export const toComment = (event: H3Event, comment: CommentRecord) => ({
  id: comment.id,
  issue: comment.issue,
  author: comment.author,
  body: comment.body,
  origin: comment.origin,
  resolution: comment.resolution,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  url: `${baseUrl(event)}/issues/${comment.issue}#comment-${comment.id}`,
});

const commentCursor = (query: Query) => {
  const key = decodeCursor(query);
  if (key === null) return null;
  const [id] = key;
  if (typeof id !== 'number') throw invalid('cursor is not valid', 'cursor');
  return id;
};

const commentList = (event: H3Event) => {
  const number = issueNumberParam(event);
  const query = getQuery(event);
  const limit = pageLimit(query);
  const rows = listComments(number, { after: commentCursor(query), limit: limit + 1 }).map(comment => toComment(event, comment));
  return pageOf(rows, limit, comment => [comment.id]);
};

const commentCreate = async (event: H3Event, principal: Principal) => {
  const number = issueNumberParam(event);
  const body = requireText(await readJsonObject(event), 'body');
  setResponseStatus(event, 201);
  return toComment(event, createComment(number, body, principal));
};

const commentEdit = async (event: H3Event, principal: Principal) => {
  const number = issueNumberParam(event);
  const id = commentIdParam(event);
  const body = requireText(await readJsonObject(event), 'body');
  return toComment(event, patchComment({ issue: number, id }, body, principal));
};

const commentRemove = (event: H3Event, principal: Principal) => {
  deleteComment({ issue: issueNumberParam(event), id: commentIdParam(event) }, principal);
  return sendNoContent(event);
};

export const commentHandlers = {
  list: commentList,
  create: commentCreate,
  edit: commentEdit,
  remove: commentRemove,
};

export const COMMENT_ID_PARAM = { name: 'id', in: 'path' as const, required: true, schema: { type: 'integer' } };
export const COMMENT_BODY_SCHEMA = { type: 'object', properties: { body: { type: 'string' } }, required: ['body'] };

const COMMENT_PROPERTIES = {
  id: { type: 'integer' },
  issue: { type: 'integer' },
  author: { type: 'string' },
  body: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  resolution: { type: 'boolean', description: 'Set only through close; the Resolution of the issue' },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  url: { type: 'string', format: 'uri' },
};

export const COMMENT_SCHEMA = { type: 'object', properties: COMMENT_PROPERTIES, required: Object.keys(COMMENT_PROPERTIES) };
