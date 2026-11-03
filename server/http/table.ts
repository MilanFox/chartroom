import type { H3Event } from 'h3';
import type { Principal } from '../utils/principal';
import { holderRoster } from './handlers/holders';
import { CHANGE_SCHEMA, DOCUMENT_SCHEMA, ISSUE_FIELDS_SCHEMA, ISSUE_LIST_PARAMS, ISSUE_NUMBER_PARAM, issueHandlers, PAGING_PARAMS, pageSchema, ROW_SCHEMA } from './handlers/issues';
import { COMMENT_BODY_SCHEMA, COMMENT_ID_PARAM, COMMENT_SCHEMA, commentHandlers } from './handlers/comments';
import { ME_SCHEMA, me } from './handlers/me';

export type RouteMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
export type Handler<Args extends unknown[], Result = unknown> = (...args: Args) => Result;

export type JsonSchema = Record<string, unknown>;

export interface OperationMeta {
  summary: string
  tags: string[]
  parameters?: { name: string, in: 'path' | 'query' | 'header', required?: boolean, schema: JsonSchema, description?: string }[]
  requestBody?: JsonSchema
  responses: Record<string, { description: string, schema?: JsonSchema }>
}

export interface TableRoute {
  method: RouteMethod
  path: string
  handler: Handler<[H3Event, Principal]>
  openapi: OperationMeta
}

export const routeTable: TableRoute[] = [
  {
    method: 'get',
    path: '/me',
    handler: me,
    openapi: {
      summary: 'The calling principal',
      tags: ['auth'],
      responses: { 200: { description: 'Me', schema: ME_SCHEMA } },
    },
  },
  {
    method: 'get',
    path: '/holders',
    handler: holderRoster,
    openapi: {
      summary: 'The Token holder roster',
      tags: ['holders'],
      responses: { 200: { description: 'Holders', schema: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, displayName: { type: ['string', 'null'] }, revoked: { type: 'boolean' } }, required: ['slug', 'displayName', 'revoked'] } } }, 403: { description: 'A non-elevated Viewer' } },
    },
  },
  {
    method: 'get',
    path: '/issues',
    handler: issueHandlers.list,
    openapi: {
      summary: 'List issues of every Kind',
      tags: ['issues'],
      parameters: [...ISSUE_LIST_PARAMS, ...PAGING_PARAMS],
      responses: { 200: { description: 'Page of Row', schema: pageSchema(ROW_SCHEMA) }, 400: { description: 'An unknown kind, state, sort or order, a non-numeric parent, an unknown effort, more than 200 numbers, or a bad limit or cursor; field set' } },
    },
  },
  {
    method: 'post',
    path: '/issues',
    handler: issueHandlers.create,
    openapi: {
      summary: 'Create an issue',
      tags: ['issues'],
      requestBody: { type: 'object', properties: { kind: { type: 'string', enum: KINDS }, ...ISSUE_FIELDS_SCHEMA }, required: ['kind', 'title'] },
      responses: {
        201: { description: 'Document', schema: DOCUMENT_SCHEMA },
        400: { description: 'A parent rule, the name shape, or name on a non-Effort; field set' },
        404: { description: 'Unknown parent' },
        409: { description: 'A second map under one Effort, or a taken Effort name' },
      },
    },
  },
  {
    method: 'get',
    path: '/issues/:number',
    handler: issueHandlers.read,
    openapi: {
      summary: 'Read an issue',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM],
      responses: { 200: { description: 'Document', schema: DOCUMENT_SCHEMA }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'patch',
    path: '/issues/:number',
    handler: issueHandlers.edit,
    openapi: {
      summary: 'Edit issue fields',
      tags: ['issues'],
      parameters: [
        ISSUE_NUMBER_PARAM,
        { name: 'If-Match', in: 'header', schema: { type: 'string' }, description: 'The expected version, quotes optional; stale is conflict with field version' },
      ],
      requestBody: { type: 'object', properties: ISSUE_FIELDS_SCHEMA },
      responses: {
        200: { description: 'Document', schema: DOCUMENT_SCHEMA },
        400: { description: 'A parent rule, orphaning a map or spec, a parent on an Effort, or name on a non-Effort' },
        404: { description: 'No such issue or parent' },
        409: { description: 'Stale If-Match (field version), a second map, or a taken Effort name' },
      },
    },
  },
  {
    method: 'delete',
    path: '/issues/:number',
    handler: issueHandlers.remove,
    openapi: {
      summary: 'Delete an issue and everything attached to it',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM],
      responses: { 204: { description: 'Deleted' }, 404: { description: 'No such issue' }, 409: { description: 'Children exist; the message carries the count' } },
    },
  },
  {
    method: 'post',
    path: '/issues/:number/claim',
    handler: issueHandlers.claim,
    openapi: {
      summary: 'Claim an issue for the caller',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM],
      responses: {
        200: { description: 'Document', schema: DOCUMENT_SCHEMA },
        400: { description: 'The issue is closed (field state)' },
        404: { description: 'No such issue' },
        409: { description: 'Held by another holder (field assignee)' },
      },
    },
  },
  {
    method: 'delete',
    path: '/issues/:number/assignee',
    handler: issueHandlers.unassign,
    openapi: {
      summary: 'Unassign an issue',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM],
      responses: { 200: { description: 'Document', schema: DOCUMENT_SCHEMA }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'post',
    path: '/issues/:number/close',
    handler: issueHandlers.close,
    openapi: {
      summary: 'Close an issue, optionally with its Resolution comment',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM],
      requestBody: { type: 'object', properties: { comment: { type: 'string', description: 'Created flagged resolution: true; the issue\'s Resolution' } } },
      responses: {
        200: { description: 'Document', schema: DOCUMENT_SCHEMA },
        400: { description: 'Already closed (field state), or a blank comment (field comment)' },
        404: { description: 'No such issue' },
      },
    },
  },
  {
    method: 'post',
    path: '/issues/:number/reopen',
    handler: issueHandlers.reopen,
    openapi: {
      summary: 'Reopen an issue; the Resolution comment keeps its flag',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM],
      responses: { 200: { description: 'Document', schema: DOCUMENT_SCHEMA }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'post',
    path: '/issues/:number/body/append',
    handler: issueHandlers.append,
    openapi: {
      summary: 'Append text under a body section',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM],
      requestBody: { type: 'object', properties: { section: { type: 'string', description: 'Heading text, any ATX level, first match wins' }, text: { type: 'string' } }, required: ['section', 'text'] },
      responses: {
        200: { description: 'Document', schema: DOCUMENT_SCHEMA },
        400: { description: 'No such section (field section)' },
        404: { description: 'No such issue' },
      },
    },
  },
  {
    method: 'get',
    path: '/issues/:number/comments',
    handler: commentHandlers.list,
    openapi: {
      summary: 'The comments of an issue, oldest first',
      tags: ['comments'],
      parameters: [ISSUE_NUMBER_PARAM, ...PAGING_PARAMS],
      responses: { 200: { description: 'Page of Comment', schema: pageSchema(COMMENT_SCHEMA) }, 400: { description: 'Bad limit or cursor' }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'post',
    path: '/issues/:number/comments',
    handler: commentHandlers.create,
    openapi: {
      summary: 'Comment on an issue',
      tags: ['comments'],
      parameters: [ISSUE_NUMBER_PARAM],
      requestBody: COMMENT_BODY_SCHEMA,
      responses: { 201: { description: 'Comment', schema: COMMENT_SCHEMA }, 400: { description: 'Blank body (field body)' }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'patch',
    path: '/issues/:number/comments/:id',
    handler: commentHandlers.edit,
    openapi: {
      summary: 'Edit an own comment',
      tags: ['comments'],
      parameters: [ISSUE_NUMBER_PARAM, COMMENT_ID_PARAM],
      requestBody: COMMENT_BODY_SCHEMA,
      responses: { 200: { description: 'Comment', schema: COMMENT_SCHEMA }, 400: { description: 'Blank body (field body)' }, 403: { description: 'Not the author' }, 404: { description: 'No such issue or comment' } },
    },
  },
  {
    method: 'delete',
    path: '/issues/:number/comments/:id',
    handler: commentHandlers.remove,
    openapi: {
      summary: 'Delete an own comment; records a comment Change',
      tags: ['comments'],
      parameters: [ISSUE_NUMBER_PARAM, COMMENT_ID_PARAM],
      responses: { 204: { description: 'Deleted' }, 403: { description: 'Not the author' }, 404: { description: 'No such issue or comment' } },
    },
  },
  {
    method: 'get',
    path: '/issues/:number/changes',
    handler: issueHandlers.changes,
    openapi: {
      summary: 'The Change log of an issue, oldest first',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM, ...PAGING_PARAMS, { name: 'field', in: 'query', schema: { type: 'string' }, description: 'Only Changes of this field' }],
      responses: { 200: { description: 'Page of Change', schema: pageSchema(CHANGE_SCHEMA) }, 400: { description: 'Bad limit or cursor' }, 404: { description: 'No such issue' } },
    },
  },
];
