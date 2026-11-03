import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';
import { ME_SCHEMA, uiMe } from '../handlers/me';
import type { MountRoute } from '../mount';

const login = async (event: H3Event) => {
  const ip = clientIp(event);
  assertNotLimited(ip);
  const secret = requireString(await readJsonObject(event), 'secret');
  const viewer = passwordMatches(secret, useDeploymentConfig().viewerPassword);
  const holder = viewer ? null : authenticateSecret(secret);
  if (!viewer && !holder) {
    recordAuthFailure(ip);
    throw unauthenticated('secret not recognised');
  }
  const previous = getCookie(event, SESSION_COOKIE);
  const previousSession = previous ? findSession(previous) : null;
  if (previousSession) deleteSession(previousSession.id);
  const token = createSession(holder?.slug ?? null);
  setSessionCookie(event, token);
  const session = findSession(token)!;
  return uiMe(sessionPrincipal(session, holder));
};

const logout = (event: H3Event, principal: Principal) => {
  deleteSession(principal.sessionId!);
  deleteCookie(event, SESSION_COOKIE, { path: '/' });
  return sendNoContent(event);
};

const elevate = async (event: H3Event, principal: Principal) => {
  const ip = clientIp(event);
  assertNotLimited(ip);
  const password = requireString(await readJsonObject(event), 'password');
  if (!passwordMatches(password, useDeploymentConfig().adminPassword)) {
    recordAuthFailure(ip);
    throw unauthenticated('admin password not recognised');
  }
  const adminUntil = isElevated(principal) ? principal.adminUntil : isoAfterSeconds(useDeploymentConfig().elevationSeconds);
  elevateSession(principal.sessionId!, adminUntil!);
  return uiMe({ ...principal, adminUntil });
};

const drop = (_event: H3Event, principal: Principal) => {
  dropElevation(principal.sessionId!);
  return uiMe({ ...principal, adminUntil: null });
};

export const authRoutes: MountRoute[] = [
  {
    method: 'post',
    path: '/login',
    public: true,
    handler: login,
    openapi: {
      summary: 'Start a session with the viewer password or a holder secret',
      tags: ['auth'],
      requestBody: { type: 'object', properties: { secret: { type: 'string' } }, required: ['secret'] },
      responses: { 200: { description: 'Me', schema: ME_SCHEMA }, 401: { description: 'Secret not recognised' }, 429: { description: 'Too many failed attempts' } },
    },
  },
  {
    method: 'post',
    path: '/logout',
    handler: logout,
    openapi: { summary: 'End the session', tags: ['auth'], responses: { 204: { description: 'Session ended' } } },
  },
  {
    method: 'post',
    path: '/elevate',
    handler: elevate,
    openapi: {
      summary: 'Elevate the session with the admin password',
      tags: ['auth'],
      requestBody: { type: 'object', properties: { password: { type: 'string' } }, required: ['password'] },
      responses: { 200: { description: 'Me', schema: ME_SCHEMA }, 401: { description: 'Admin password not recognised' }, 429: { description: 'Too many failed attempts' } },
    },
  },
  {
    method: 'delete',
    path: '/elevate',
    handler: drop,
    openapi: { summary: 'Drop the elevation', tags: ['auth'], responses: { 200: { description: 'Me', schema: ME_SCHEMA } } },
  },
];
