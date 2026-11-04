import type { H3Event } from 'h3';
import type { Principal } from '../utils/principal';
import { holderRoster } from './handlers/holders';
import { BLOCKER_NUMBER_PARAM, CHANGE_SCHEMA, DOCUMENT_SCHEMA, ISSUE_CREATE_SCHEMA, ISSUE_FIELDS_SCHEMA, ISSUE_LIST_PARAMS, ISSUE_NUMBER_PARAM, ISSUE_PAGE_SCHEMA, issueHandlers, LABEL_PARAM, PAGING_PARAMS, pageSchema } from './handlers/issues';
import { EFFORT_DOCUMENT_SCHEMA, EFFORT_HANDLE_PARAM, EFFORT_LIST_PARAMS, EFFORT_PAGE_SCHEMA, effortHandlers } from './handlers/efforts';
import { COMMENT_BODY_SCHEMA, COMMENT_ID_PARAM, COMMENT_SCHEMA, commentHandlers } from './handlers/comments';
import { LABEL_GROUP_SCHEMA, labelGroupList } from './handlers/labels';
import { LINK_CREATE_SCHEMA, LINK_FIELDS_SCHEMA, LINK_ID_PARAM, LINK_SCHEMA, linkHandlers } from './handlers/links';
import { ENVIRONMENT_SCHEMA, environmentList, POINTER_SCHEMA, pointerList } from './handlers/environments';
import { adapterFile, INSTANCE_SCHEMA, instanceRead } from './handlers/instance';
import { API_ME_SCHEMA, me } from './handlers/me';

export type RouteMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
export type Handler<Args extends unknown[], Result = unknown> = (...args: Args) => Result;

export type JsonSchema = Record<string, unknown>;

export interface OperationMeta {
  summary: string
  tags: string[]
  description?: string
  parameters?: { name: string, in: 'path' | 'query' | 'header', required?: boolean, schema: JsonSchema, description?: string }[]
  requestBody?: JsonSchema
  responses: Record<string, { description: string, schema?: JsonSchema, contentType?: string }>
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
      responses: { 200: { description: 'Me', schema: API_ME_SCHEMA } },
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
      responses: { 200: { description: 'Page of Row with per-Effort totals', schema: ISSUE_PAGE_SCHEMA }, 400: { description: 'An unknown kind, state, view, assignee, sort or order, an unknown Label group in missing or sort, a blank label, view mine without a Token holder, a non-numeric parent, an unknown effort, more than 200 numbers, or a bad limit or cursor; field set' } },
    },
  },
  {
    method: 'post',
    path: '/issues',
    handler: issueHandlers.create,
    openapi: {
      summary: 'Create an issue',
      tags: ['issues'],
      requestBody: { type: 'object', properties: { kind: { type: 'string', enum: KINDS }, ...ISSUE_CREATE_SCHEMA }, required: ['kind', 'title'] },
      responses: {
        201: { description: 'Document', schema: DOCUMENT_SCHEMA },
        400: { description: 'A parent rule, the name shape, name on a non-Effort, or a bad labels or blockedBy shape; field set' },
        404: { description: 'Unknown parent or blocker' },
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
      description: 'Without If-Match the last write wins. With it, a stale version is a conflict whose message names who last wrote and when.',
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
      responses: { 204: { description: 'Deleted; each issue it blocked gets a blocker removal Change' }, 404: { description: 'No such issue' }, 409: { description: 'Children exist; the message carries the count' } },
    },
  },
  {
    method: 'post',
    path: '/issues/:number/claim',
    handler: issueHandlers.claim,
    openapi: {
      summary: 'Claim an issue for the caller',
      tags: ['issues'],
      description: 'Assigns the issue to the calling Token holder, signalling that it is being worked. An issue claimed by someone else cannot be claimed.',
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
      description: 'Atomic and safe to run alongside other writers: ignores If-Match and bumps version. The section runs to the next heading of the same or higher level; text goes after its last non-blank line. A missing section is never created.',
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
    method: 'put',
    path: '/issues/:number/labels/:label',
    handler: issueHandlers.labelAdd,
    openapi: {
      summary: 'Add a label; a label group member removes its siblings in the same write',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM, LABEL_PARAM],
      responses: { 204: { description: 'Added, or already carried' }, 400: { description: 'Blank label (field label)' }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'delete',
    path: '/issues/:number/labels/:label',
    handler: issueHandlers.labelRemove,
    openapi: {
      summary: 'Remove a label',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM, LABEL_PARAM],
      responses: { 204: { description: 'Removed, or never carried' }, 400: { description: 'Blank label (field label)' }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'put',
    path: '/issues/:number/blockers/:blocker',
    handler: issueHandlers.blockerAdd,
    openapi: {
      summary: 'Mark an issue as blocked by another; records a blocker Change on the blocked issue',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM, BLOCKER_NUMBER_PARAM],
      responses: { 204: { description: 'Added, or already present' }, 400: { description: 'A self-block or a cycle (field blocker)' }, 404: { description: 'No such issue or blocker' } },
    },
  },
  {
    method: 'delete',
    path: '/issues/:number/blockers/:blocker',
    handler: issueHandlers.blockerRemove,
    openapi: {
      summary: 'Remove a blocker; records a blocker Change on the blocked issue',
      tags: ['issues'],
      parameters: [ISSUE_NUMBER_PARAM, BLOCKER_NUMBER_PARAM],
      responses: { 204: { description: 'Removed, or never present' }, 404: { description: 'No such issue' } },
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
    path: '/issues/:number/links',
    handler: linkHandlers.list,
    openapi: {
      summary: 'The Links of an issue, oldest first',
      tags: ['links'],
      parameters: [ISSUE_NUMBER_PARAM, ...PAGING_PARAMS],
      responses: { 200: { description: 'Page of Link', schema: pageSchema(LINK_SCHEMA) }, 400: { description: 'Bad limit or cursor' }, 404: { description: 'No such issue' } },
    },
  },
  {
    method: 'post',
    path: '/issues/:number/links',
    handler: linkHandlers.create,
    openapi: {
      summary: 'Attach a Link to an issue',
      tags: ['links'],
      parameters: [ISSUE_NUMBER_PARAM],
      requestBody: LINK_CREATE_SCHEMA,
      responses: { 201: { description: 'Link', schema: LINK_SCHEMA }, 400: { description: 'A bad role, type, url or title; field set' }, 404: { description: 'No such issue' }, 409: { description: 'The URL is already linked on this issue (field url)' } },
    },
  },
  {
    method: 'patch',
    path: '/issues/:number/links/:id',
    handler: linkHandlers.edit,
    openapi: {
      summary: 'Edit the role, type or title of a Link',
      tags: ['links'],
      parameters: [ISSUE_NUMBER_PARAM, LINK_ID_PARAM],
      requestBody: LINK_FIELDS_SCHEMA,
      responses: { 200: { description: 'Link', schema: LINK_SCHEMA }, 400: { description: 'A bad role, type or title; field set' }, 404: { description: 'No such issue or Link' } },
    },
  },
  {
    method: 'delete',
    path: '/issues/:number/links/:id',
    handler: linkHandlers.remove,
    openapi: {
      summary: 'Remove a Link; records a link Change with its id, title and url',
      tags: ['links'],
      parameters: [ISSUE_NUMBER_PARAM, LINK_ID_PARAM],
      responses: { 204: { description: 'Removed' }, 404: { description: 'No such issue or Link' } },
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
  {
    method: 'get',
    path: '/efforts',
    handler: effortHandlers.list,
    openapi: {
      summary: 'List Efforts as Effort documents',
      tags: ['efforts'],
      parameters: EFFORT_LIST_PARAMS,
      responses: { 200: { description: 'Page of Effort document', schema: EFFORT_PAGE_SCHEMA }, 400: { description: 'An unknown sort or order, or a bad limit or cursor; field set' } },
    },
  },
  {
    method: 'get',
    path: '/efforts/:handle',
    handler: effortHandlers.read,
    openapi: {
      summary: 'Read an Effort by slug or number, with its roll-ups, map and specs',
      tags: ['efforts'],
      parameters: [EFFORT_HANDLE_PARAM],
      responses: { 200: { description: 'Effort document', schema: EFFORT_DOCUMENT_SCHEMA }, 400: { description: 'The number is not an Effort (field handle)' }, 404: { description: 'No such Effort' } },
    },
  },
  {
    method: 'get',
    path: '/efforts/:handle/artifacts.md',
    handler: effortHandlers.artifacts,
    openapi: {
      summary: 'The Artifacts of the roll-up as markdown, one list item per Artifact',
      tags: ['efforts'],
      parameters: [EFFORT_HANDLE_PARAM],
      responses: { 200: { description: 'Markdown', contentType: 'text/markdown', schema: { type: 'string' } }, 400: { description: 'The number is not an Effort (field handle)' }, 404: { description: 'No such Effort' } },
    },
  },
  {
    method: 'get',
    path: '/labels',
    handler: labelGroupList,
    openapi: {
      summary: 'The Label groups in group order, seeded groups first',
      tags: ['labels'],
      responses: { 200: { description: 'Label groups', schema: { type: 'array', items: LABEL_GROUP_SCHEMA } } },
    },
  },
  {
    method: 'get',
    path: '/instance',
    handler: instanceRead,
    openapi: {
      summary: 'The Instance settings, version and open issue count',
      tags: ['instance'],
      responses: { 200: { description: 'Instance', schema: INSTANCE_SCHEMA } },
    },
  },
  ...ADAPTER_FILES.map(file => ({
    method: 'get' as const,
    path: `/instance/adapter/${file}`,
    handler: adapterFile(file),
    openapi: {
      summary: `The generated Adapter file ${file}, in this Instance's words`,
      tags: ['instance'],
      description: 'Part of the Adapter, the docs that teach an agent skillset to use this tracker. Display names come from this Instance\'s settings.',
      responses: { 200: { description: 'Markdown', contentType: 'text/markdown', schema: { type: 'string' } } },
    },
  })),
  {
    method: 'get',
    path: '/environments',
    handler: environmentList,
    openapi: {
      summary: 'The Environments with their Credential pointers',
      tags: ['instance'],
      responses: { 200: { description: 'Environments', schema: { type: 'array', items: ENVIRONMENT_SCHEMA } } },
    },
  },
  {
    method: 'get',
    path: '/credential-pointers',
    handler: pointerList,
    openapi: {
      summary: 'Every Credential pointer, bound or not',
      tags: ['instance'],
      responses: { 200: { description: 'Credential pointers', schema: { type: 'array', items: POINTER_SCHEMA } }, 403: { description: 'A non-elevated Viewer' } },
    },
  },
];
