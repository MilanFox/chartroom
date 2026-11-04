import type { H3Event } from 'h3';
import type { Caller } from '../../utils/caller';
import { toComment } from '../representations';
import { commentIdParam, issueNumberParam } from './params';

const commentList = (event: H3Event) => {
  const number = issueNumberParam(event);
  const query = getQuery(event);
  const limit = pageLimit(query);
  const rows = listComments(number, { after: idCursor(query), limit: limit + 1 }).map(comment => toComment(event, comment));
  return pageOf(rows, limit, comment => [comment.id]);
};

const commentCreate = async (event: H3Event, caller: Caller) => {
  const number = issueNumberParam(event);
  const body = requireText(await readJsonObject(event), 'body');
  setResponseStatus(event, 201);
  return toComment(event, createComment(number, body, caller));
};

const commentEdit = async (event: H3Event, caller: Caller) => {
  const number = issueNumberParam(event);
  const id = commentIdParam(event);
  const body = requireText(await readJsonObject(event), 'body');
  return toComment(event, patchComment({ issue: number, id }, body, caller));
};

const commentRemove = (event: H3Event, caller: Caller) => {
  deleteComment({ issue: issueNumberParam(event), id: commentIdParam(event) }, caller);
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
