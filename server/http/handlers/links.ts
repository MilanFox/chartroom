import type { H3Event } from 'h3';
import type { JsonObject } from '../../utils/body';
import type { LinkFields } from '../../utils/links';
import type { Principal } from '../../utils/principal';
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

const linkCreate = async (event: H3Event, principal: Principal) => {
  const number = issueNumberParam(event);
  const body = await readJsonObject(event);
  const input = { role: oneOf(body.role, 'role', LINK_ROLES), type: oneOf(body.type, 'type', LINK_TYPES), url: absoluteUrl(body), title: requireText(body, 'title') };
  setResponseStatus(event, 201);
  return toLink(createLink(number, input, principal));
};

const linkEdit = async (event: H3Event, principal: Principal) => {
  const ref = { issue: issueNumberParam(event), id: linkIdParam(event) };
  return toLink(patchLink(ref, linkFields(await readJsonObject(event)), principal));
};

const linkRemove = (event: H3Event, principal: Principal) => {
  deleteLink({ issue: issueNumberParam(event), id: linkIdParam(event) }, principal);
  return sendNoContent(event);
};

export const linkHandlers = {
  list: linkList,
  create: linkCreate,
  edit: linkEdit,
  remove: linkRemove,
};

export const LINK_ID_PARAM = { name: 'id', in: 'path' as const, required: true, schema: { type: 'integer' } };

export const LINK_CREATE_SCHEMA = { type: 'object', properties: { ...LINK_FIELDS, url: { type: 'string', format: 'uri', description: 'Absolute; unique per issue' } }, required: ['role', 'type', 'url', 'title'] };
export const LINK_FIELDS_SCHEMA = { type: 'object', properties: LINK_FIELDS };
