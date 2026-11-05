import type { H3Event } from 'h3';
import type { Caller } from '../../utils/caller';
import { EFFORT_HANDLE_PARAM } from '../handlers/efforts';
import { effortSlugParam } from '../handlers/params';
import type { MountRoute } from '../mount';
import { SNAPSHOT_SCHEMA } from './snapshots';

const closedEffortList = () => listClosedEfforts();

const effortDelete = (event: H3Event, caller: Caller) => deleteEffort(effortSlugParam(event), caller);

const CONTENTS_SCHEMA = {
  type: 'object',
  properties: { issues: { type: 'integer' }, comments: { type: 'integer' }, links: { type: 'integer' }, changes: { type: 'integer' }, researchNotes: { type: 'integer' } },
  required: ['issues', 'comments', 'links', 'changes', 'researchNotes'],
};

const CLOSED_EFFORT_SCHEMA = {
  type: 'object',
  properties: {
    number: { type: 'integer' },
    name: { type: ['string', 'null'] },
    title: { type: 'string' },
    closedAt: { type: ['string', 'null'] },
    lastActivityAt: { type: 'string', description: 'Newest write anywhere in the subtree' },
    counts: CONTENTS_SCHEMA,
  },
  required: ['number', 'name', 'title', 'closedAt', 'lastActivityAt', 'counts'],
};

const DELETION_SCHEMA = {
  type: 'object',
  properties: { snapshot: SNAPSHOT_SCHEMA, deleted: CONTENTS_SCHEMA, vacuumed: { type: 'boolean', description: 'False when compacting the store failed; the deletion stands' } },
  required: ['snapshot', 'deleted', 'vacuumed'],
};

export const effortAdminRoutes: MountRoute[] = [
  {
    method: 'get',
    path: '/admin/closed-efforts',
    handler: closedEffortList,
    elevated: true,
    openapi: {
      summary: 'List the closed Efforts with their contents, oldest last activity first',
      tags: ['efforts'],
      responses: { 200: { description: 'Closed Efforts', schema: { type: 'array', items: CLOSED_EFFORT_SCHEMA } } },
    },
  },
  {
    method: 'delete',
    path: '/efforts/:handle',
    handler: effortDelete,
    elevated: true,
    openapi: {
      summary: 'Permanently delete a closed Effort with its subtree, after a pre-delete Snapshot, then compact the store',
      tags: ['efforts'],
      parameters: [EFFORT_HANDLE_PARAM],
      responses: {
        200: { description: 'The Snapshot taken and what was deleted', schema: DELETION_SCHEMA },
        400: { description: 'The number is not an Effort (field handle)' },
        404: { description: 'No such Effort' },
        409: { description: 'The Effort is open' },
        500: { description: 'The Snapshot failed (code internal); nothing is deleted' },
      },
    },
  },
];
