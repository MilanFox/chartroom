import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';
import { fullHolder } from '../handlers/holders';
import type { MountRoute } from '../mount';

const requireElevation = (principal: Principal) => {
  if (!isElevated(principal)) throw forbidden('holder administration requires elevation');
};

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

export const holderAdminRoutes: MountRoute[] = [
  { method: 'post', path: '/holders', handler: create },
  { method: 'post', path: '/holders/:slug/rotate', handler: rotate },
  { method: 'post', path: '/holders/:slug/revoke', handler: revoke },
];
