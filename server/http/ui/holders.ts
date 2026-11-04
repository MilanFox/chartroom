import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';
import type { MountRoute } from '../mount';
import { fullHolder, HOLDER_SCHEMA, HOLDER_WITH_SECRET_SCHEMA } from '../representations';

const create = async (event: H3Event, principal: Principal) => {
  const body = await readJsonObject(event);
  const input = { slug: requireString(body, 'slug'), displayName: optionalString(body, 'displayName') };
  const { holder, secret } = createHolder(input, actorSlug(principal));
  setResponseStatus(event, 201);
  return { ...fullHolder(holder), secret };
};

const rotate = (event: H3Event, principal: Principal) => {
  const { holder, secret } = rotateHolder(getRouterParam(event, 'slug')!, actorSlug(principal));
  return { ...fullHolder(holder), secret };
};

const revoke = (event: H3Event, principal: Principal) => fullHolder(revokeHolder(getRouterParam(event, 'slug')!, actorSlug(principal)));

const NO_SUCH_HOLDER = { description: 'No such holder' };

export const holderAdminRoutes: MountRoute[] = [
  {
    method: 'post',
    path: '/holders',
    handler: create,
    elevated: true,
    openapi: {
      summary: 'Create a Token holder',
      tags: ['holders'],
      requestBody: { type: 'object', properties: { slug: { type: 'string' }, displayName: { type: 'string' } }, required: ['slug'] },
      responses: { 201: { description: 'The holder with its one-time secret', schema: HOLDER_WITH_SECRET_SCHEMA }, 400: { description: 'Invalid input' }, 409: { description: 'Slug taken' } },
    },
  },
  {
    method: 'post',
    path: '/holders/:slug/rotate',
    handler: rotate,
    elevated: true,
    openapi: {
      summary: 'Rotate a Token holder secret',
      tags: ['holders'],
      responses: { 200: { description: 'The holder with its new secret', schema: HOLDER_WITH_SECRET_SCHEMA }, 404: NO_SUCH_HOLDER },
    },
  },
  {
    method: 'post',
    path: '/holders/:slug/revoke',
    handler: revoke,
    elevated: true,
    openapi: {
      summary: 'Revoke a Token holder',
      tags: ['holders'],
      responses: { 200: { description: 'The revoked holder', schema: HOLDER_SCHEMA }, 404: NO_SUCH_HOLDER },
    },
  },
];
