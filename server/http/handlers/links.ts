import type { H3Event } from 'h3';
import type { JsonObject } from '../../utils/body';
import type { LinkFields, LinkRecord } from '../../utils/links';
import type { Query } from '../../utils/paging';
import type { Principal } from '../../utils/principal';
import { issueNumberParam, linkIdParam } from './params';

export const toLink = (link: LinkRecord) => ({
  id: link.id,
  issue: link.issue,
  role: link.role,
  type: link.type,
  url: link.url,
  title: link.title,
  addedBy: link.addedBy,
  origin: link.origin,
  createdAt: link.createdAt,
});

const oneOf = <T extends string>(body: JsonObject, field: string, allowed: readonly T[]): T => {
  const value = body[field];
  if (!allowed.includes(value as T)) throw invalid(`${field} must be one of ${allowed.join(', ')}`, field);
  return value as T;
};

const absoluteUrl = (body: JsonObject) => {
  const value = body.url;
  if (typeof value !== 'string' || !URL.canParse(value)) throw invalid('url must be an absolute URL', 'url');
  return value;
};

const linkFields = (body: JsonObject): LinkFields => {
  const fields: LinkFields = {};
  if ('role' in body) fields.role = oneOf(body, 'role', LINK_ROLES);
  if ('type' in body) fields.type = oneOf(body, 'type', LINK_TYPES);
  if ('title' in body) fields.title = requireText(body, 'title');
  return fields;
};

const linkCursor = (query: Query) => {
  const key = decodeCursor(query);
  if (key === null) return null;
  const [id] = key;
  if (typeof id !== 'number') throw invalid('cursor is not valid', 'cursor');
  return id;
};

const linkList = (event: H3Event) => {
  const number = issueNumberParam(event);
  const query = getQuery(event);
  const limit = pageLimit(query);
  const rows = listLinks(number, { after: linkCursor(query), limit: limit + 1 }).map(toLink);
  return pageOf(rows, limit, link => [link.id]);
};

const linkCreate = async (event: H3Event, principal: Principal) => {
  const number = issueNumberParam(event);
  const body = await readJsonObject(event);
  const input = { role: oneOf(body, 'role', LINK_ROLES), type: oneOf(body, 'type', LINK_TYPES), url: absoluteUrl(body), title: requireText(body, 'title') };
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

const LINK_FIELDS = {
  role: { type: 'string', enum: LINK_ROLES },
  type: { type: 'string', enum: LINK_TYPES, description: 'external is the fallback' },
  title: { type: 'string' },
};

export const LINK_CREATE_SCHEMA = { type: 'object', properties: { ...LINK_FIELDS, url: { type: 'string', format: 'uri', description: 'Absolute; unique per issue' } }, required: ['role', 'type', 'url', 'title'] };
export const LINK_FIELDS_SCHEMA = { type: 'object', properties: LINK_FIELDS };

const LINK_PROPERTIES = {
  id: { type: 'integer' },
  issue: { type: 'integer' },
  ...LINK_FIELDS,
  url: { type: 'string', format: 'uri', description: 'The target; a Link has no tracker address' },
  addedBy: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  createdAt: { type: 'string', format: 'date-time' },
};

export const LINK_SCHEMA = { type: 'object', properties: LINK_PROPERTIES, required: Object.keys(LINK_PROPERTIES) };
