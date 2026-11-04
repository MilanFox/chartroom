import type { H3Event } from 'h3';
import type { JsonObject } from '../../utils/body';
import type { Principal } from '../../utils/principal';
import { LABEL_GROUP_SCHEMA } from '../handlers/labels';
import type { MountRoute } from '../mount';

const optionalText = (body: JsonObject, field: string) => (body[field] ?? null) === null ? null : requireText(body, field);

const memberOf = (body: JsonObject) => ({ id: requireString(body, 'id'), displayLabel: optionalText(body, 'displayLabel') });

const membersOf = (body: JsonObject) => {
  const value = body.labels ?? [];
  if (!Array.isArray(value)) throw invalid('labels must be an array of members', 'labels');
  return value.map((member: unknown) => {
    const { id, displayLabel } = (member ?? {}) as JsonObject;
    const blankLabel = (displayLabel ?? null) !== null && (typeof displayLabel !== 'string' || displayLabel.trim() === '');
    if (typeof id !== 'string' || blankLabel) throw invalid('each label needs a string id and an optional non-blank displayLabel', 'labels');
    return { id, displayLabel: (displayLabel ?? null) as string | null };
  });
};

const idList = (body: JsonObject, field: string) => {
  const value = body[field];
  if (!Array.isArray(value) || !value.every(id => typeof id === 'string')) throw invalid(`${field} must be an array of ids`, field);
  return value as string[];
};

const groupCreate = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const body = await readJsonObject(event);
  const input = { id: requireString(body, 'id'), displayName: optionalText(body, 'displayName'), labels: membersOf(body) };
  setResponseStatus(event, 201);
  return createLabelGroup(input, actorSlug(principal));
};

const groupParam = (event: H3Event) => getRouterParam(event, 'id', { decode: true }) ?? '';

const groupRename = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const id = groupParam(event);
  return renameLabelGroup(id, requireText(await readJsonObject(event), 'displayName'), actorSlug(principal));
};

const groupReorder = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  return reorderLabelGroups(idList(await readJsonObject(event), 'groups'), actorSlug(principal));
};

const groupDelete = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  deleteLabelGroup(groupParam(event));
  return sendNoContent(event);
};

const memberAdd = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const id = groupParam(event);
  const member = memberOf(await readJsonObject(event));
  setResponseStatus(event, 201);
  return addGroupMember(id, member, actorSlug(principal));
};

const memberParam = (event: H3Event) => getRouterParam(event, 'label', { decode: true }) ?? '';

const memberRename = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const id = groupParam(event);
  const label = memberParam(event);
  return renameGroupMember(id, { id: label, displayLabel: requireText(await readJsonObject(event), 'displayLabel') }, actorSlug(principal));
};

const memberReorder = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const id = groupParam(event);
  return reorderGroupMembers(id, idList(await readJsonObject(event), 'labels'), actorSlug(principal));
};

const memberRemove = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  return removeGroupMember(groupParam(event), memberParam(event), actorSlug(principal));
};

const ADMIN_LABEL_GROUP_SCHEMA = { type: 'object', properties: { ...LABEL_GROUP_SCHEMA.properties, updatedAt: { type: ['string', 'null'] }, updatedBy: { type: ['string', 'null'] } } };
const ADMIN_LABEL_GROUP = { description: 'The admin Label group', schema: ADMIN_LABEL_GROUP_SCHEMA };
const MEMBER_BODY = { type: 'object', properties: { id: { type: 'string' }, displayLabel: { type: 'string' } }, required: ['id'] };
const ELEVATION_REQUIRED = { description: 'Elevation required' };
const SEEDED_GROUP = 'A seeded group (field id)';
const NO_SUCH_GROUP = { description: 'No such Label group' };
const NO_SUCH_MEMBER = { description: 'No such Label group or member' };
const ADOPTION_CLASH = { description: 'An issue would carry two members of the group; the message lists up to 20 issue numbers' };

export const labelGroupAdminRoutes: MountRoute[] = [
  {
    method: 'post',
    path: '/label-groups',
    handler: groupCreate,
    openapi: {
      summary: 'Create an admin Label group, adopting issues that already carry its members',
      tags: ['labels'],
      requestBody: { type: 'object', properties: { id: { type: 'string' }, displayName: { type: 'string' }, labels: { type: 'array', items: MEMBER_BODY } }, required: ['id'] },
      responses: {
        201: ADMIN_LABEL_GROUP,
        400: { description: 'A non-slug or reserved id (field id), a non-slug, repeated or already grouped member id (field labels)' },
        403: ELEVATION_REQUIRED,
        409: { description: `The id is taken (field id), or ${ADOPTION_CLASH.description.toLowerCase()}` },
      },
    },
  },
  {
    method: 'put',
    path: '/label-groups/order',
    handler: groupReorder,
    openapi: {
      summary: 'Reorder the admin Label groups; the seeded groups always come first',
      tags: ['labels'],
      requestBody: { type: 'object', properties: { groups: { type: 'array', items: { type: 'string' }, description: 'Exactly the admin group ids, each once' } }, required: ['groups'] },
      responses: { 200: { description: 'The admin Label groups in their new order', schema: { type: 'array', items: ADMIN_LABEL_GROUP_SCHEMA } }, 400: { description: 'Not a permutation of the admin group ids (field groups)' }, 403: ELEVATION_REQUIRED },
    },
  },
  {
    method: 'patch',
    path: '/label-groups/:id',
    handler: groupRename,
    openapi: {
      summary: 'Rename an admin Label group',
      tags: ['labels'],
      requestBody: { type: 'object', properties: { displayName: { type: 'string' } }, required: ['displayName'] },
      responses: { 200: ADMIN_LABEL_GROUP, 400: { description: `${SEEDED_GROUP} or a blank displayName` }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_GROUP },
    },
  },
  {
    method: 'delete',
    path: '/label-groups/:id',
    handler: groupDelete,
    openapi: {
      summary: 'Delete an admin Label group; issues keep its labels as free-form labels',
      tags: ['labels'],
      responses: { 204: { description: 'Deleted' }, 400: { description: SEEDED_GROUP }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_GROUP },
    },
  },
  {
    method: 'post',
    path: '/label-groups/:id/labels',
    handler: memberAdd,
    openapi: {
      summary: 'Append a member to an admin Label group, adopting issues that already carry it',
      tags: ['labels'],
      requestBody: MEMBER_BODY,
      responses: { 201: ADMIN_LABEL_GROUP, 400: { description: `${SEEDED_GROUP}, or a non-slug or already grouped member id (field id)` }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_GROUP, 409: ADOPTION_CLASH },
    },
  },
  {
    method: 'put',
    path: '/label-groups/:id/labels/order',
    handler: memberReorder,
    openapi: {
      summary: 'Reorder the members of an admin Label group',
      tags: ['labels'],
      requestBody: { type: 'object', properties: { labels: { type: 'array', items: { type: 'string' }, description: 'Exactly the member ids, each once' } }, required: ['labels'] },
      responses: { 200: ADMIN_LABEL_GROUP, 400: { description: `${SEEDED_GROUP} or not a permutation of the member ids (field labels)` }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_GROUP },
    },
  },
  {
    method: 'patch',
    path: '/label-groups/:id/labels/:label',
    handler: memberRename,
    openapi: {
      summary: 'Rename a member of an admin Label group',
      tags: ['labels'],
      requestBody: { type: 'object', properties: { displayLabel: { type: 'string' } }, required: ['displayLabel'] },
      responses: { 200: ADMIN_LABEL_GROUP, 400: { description: `${SEEDED_GROUP} or a blank displayLabel` }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_MEMBER },
    },
  },
  {
    method: 'delete',
    path: '/label-groups/:id/labels/:label',
    handler: memberRemove,
    openapi: {
      summary: 'Remove a member; issues keep the label as a free-form label',
      tags: ['labels'],
      responses: { 200: ADMIN_LABEL_GROUP, 400: { description: SEEDED_GROUP }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_MEMBER },
    },
  },
  {
    method: 'get',
    path: '/labels/free-form',
    handler: listFreeFormLabels,
    openapi: {
      summary: 'The labels on issues that are no Label group member, with how many issues carry each, most used first',
      tags: ['labels'],
      responses: { 200: { description: 'Free-form labels', schema: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, count: { type: 'integer' } }, required: ['label', 'count'] } } } },
    },
  },
];
