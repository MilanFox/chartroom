import type { H3Event } from 'h3';
import type { HolderRecord } from './holders';
import type { SessionRecord } from './sessions';

export interface Caller {
  origin: 'api' | 'ui'
  slug: string | null
  displayName: string | null
  viewer: boolean
  adminUntil: string | null
  sessionId: string | null
}

export const isElevated = (caller: Caller) => caller.adminUntil !== null && caller.adminUntil > nowIso();

export const actorSlug = (caller: Caller) => caller.slug ?? 'admin';

export const sessionCaller = (session: SessionRecord, holder: HolderRecord | null): Caller => ({
  origin: 'ui',
  slug: holder?.slug ?? null,
  displayName: holder?.displayName ?? null,
  viewer: holder === null,
  adminUntil: session.adminUntil,
  sessionId: session.id,
});

export const resolveBearerCaller = (event: H3Event): Caller => {
  const ip = clientIp(event);
  assertNotLimited(ip);
  const authorization = getRequestHeader(event, 'authorization') ?? '';
  const holder = authorization.startsWith('Bearer ') ? authenticateSecret(authorization.slice('Bearer '.length)) : null;
  if (!holder) {
    recordAuthFailure(ip);
    throw unauthenticated('a valid bearer secret is required');
  }
  return { origin: 'api', slug: holder.slug, displayName: holder.displayName, viewer: false, adminUntil: null, sessionId: null };
};

export const resolveSessionCaller = (event: H3Event): Caller => {
  const token = getCookie(event, SESSION_COOKIE);
  const session = token ? findSession(token) : null;
  if (!session) throw unauthenticated('a valid session is required');
  const holder = session.holderSlug ? findHolder(session.holderSlug) : null;
  if (session.holderSlug && (!holder || holder.revokedAt)) {
    deleteSession(session.id);
    throw unauthenticated('a valid session is required');
  }
  setSessionCookie(event, token!);
  return sessionCaller(session, holder);
};
