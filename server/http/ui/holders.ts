import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';
import { fullHolder } from '../handlers/holders';
import type { MountRoute } from '../mount';
import type { JsonSchema } from '../table';

const create = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const body = await readJsonObject(event);
  const input = { slug: requireString(body, 'slug'), displayName: optionalString(body, 'displayName') };
  const { holder, secret } = createHolder(input, actorSlug(principal));
  setResponseStatus(event, 201);
  return { ...fullHolder(holder), secret };
};

const rotate = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const { holder, secret } = rotateHolder(getRouterParam(event, 'slug')!, actorSlug(principal));
  return { ...fullHolder(holder), secret };
};

const revoke = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  return fullHolder(revokeHolder(getRouterParam(event, 'slug')!, actorSlug(principal)));
};

const HOLDER_PROPERTIES = {
  slug: { type: 'string' },
  displayName: { type: ['string', 'null'] },
  revoked: { type: 'boolean' },
  createdAt: { type: 'string' },
  revokedAt: { type: ['string', 'null'] },
  lastUsedAt: { type: ['string', 'null'] },
  updatedAt: { type: 'string' },
  updatedBy: { type: 'string' },
  secretHistory: { type: 'array', items: { type: 'object', properties: { hash: { type: 'string' }, createdAt: { type: 'string' }, revokedAt: { type: ['string', 'null'] } } } },
};
const HOLDER_SCHEMA: JsonSchema = { type: 'object', properties: HOLDER_PROPERTIES, required: ['slug', 'displayName', 'revoked'] };
const HOLDER_WITH_SECRET_SCHEMA: JsonSchema = { type: 'object', properties: { ...HOLDER_PROPERTIES, secret: { type: 'string' } }, required: ['slug', 'displayName', 'revoked', 'secret'] };
const ELEVATION_REQUIRED = { description: 'Elevation required' };
const NO_SUCH_HOLDER = { description: 'No such holder' };

export const holderAdminRoutes: MountRoute[] = [
  {
    method: 'post',
    path: '/holders',
    handler: create,
    openapi: {
      summary: 'Create a Token holder',
      tags: ['holders'],
      requestBody: { type: 'object', properties: { slug: { type: 'string' }, displayName: { type: 'string' } }, required: ['slug'] },
      responses: { 201: { description: 'The holder with its one-time secret', schema: HOLDER_WITH_SECRET_SCHEMA }, 400: { description: 'Invalid input' }, 403: ELEVATION_REQUIRED, 409: { description: 'Slug taken' } },
    },
  },
  {
    method: 'post',
    path: '/holders/:slug/rotate',
    handler: rotate,
    openapi: {
      summary: 'Rotate a Token holder secret',
      tags: ['holders'],
      responses: { 200: { description: 'The holder with its new secret', schema: HOLDER_WITH_SECRET_SCHEMA }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_HOLDER },
    },
  },
  {
    method: 'post',
    path: '/holders/:slug/revoke',
    handler: revoke,
    openapi: {
      summary: 'Revoke a Token holder',
      tags: ['holders'],
      responses: { 200: { description: 'The revoked holder', schema: HOLDER_SCHEMA }, 403: ELEVATION_REQUIRED, 404: NO_SUCH_HOLDER },
    },
  },
];
