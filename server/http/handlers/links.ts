import type { H3Event } from 'h3';
import type { JsonObject } from '../../utils/body';
import type { LinkFields } from '../../utils/links';
import type { Caller } from '../../utils/caller';
import { LINK_FIELDS, toLink } from '../representations';
import { issueNumberParam, linkIdParam } from './params';

const linkFields = (body: JsonObject): LinkFields => {
  const fields: LinkFields = {};
  if ('role' in body) fields.role = oneOf(body.role, 'role', LINK_ROLES);
  if ('type' in body) fields.type = oneOf(body.type, 'type', LINK_TYPES);
  if ('title' in body) fields.title = requireText(body, 'title');
  return fields;
};

const linkList = (event: H3Event) => {
  const number = issueNumberParam(event);
  const query = getQuery(event);
  const limit = pageLimit(query);
  const rows = listLinks(number, { after: idCursor(query), limit: limit + 1 }).map(toLink);
  return pageOf(rows, limit, link => [link.id]);
};

const linkCreate = async (event: H3Event, caller: Caller) => {
  const number = issueNumberParam(event);
  const body = await readJsonObject(event);
  const type = oneOf(body.type, 'type', LINK_TYPES);
  const input = { role: oneOf(body.role, 'role', LINK_ROLES), type, url: linkTarget(body, type), title: requireText(body, 'title') };
  setResponseStatus(event, 201);
  return toLink(createLink(number, input, caller));
};

const linkEdit = async (event: H3Event, caller: Caller) => {
  const ref = { issue: issueNumberParam(event), id: linkIdParam(event) };
  return toLink(patchLink(ref, linkFields(await readJsonObject(event)), caller));
};

const linkRemove = (event: H3Event, caller: Caller) => {
  deleteLink({ issue: issueNumberParam(event), id: linkIdParam(event) }, caller);
  return sendNoContent(event);
};

export const linkHandlers = {
  list: linkList,
  create: linkCreate,
  edit: linkEdit,
  remove: linkRemove,
};

export const LINK_ID_PARAM = { name: 'id', in: 'path' as const, required: true, schema: { type: 'integer' } };

export const LINK_CREATE_SCHEMA = { type: 'object', properties: { ...LINK_FIELDS, url: { type: 'string', description: 'Absolute, unique per issue; a branch Link may be a branch name and a file Link a repo-relative path' } }, required: ['role', 'type', 'url', 'title'] };
export const LINK_FIELDS_SCHEMA = { type: 'object', properties: LINK_FIELDS };
