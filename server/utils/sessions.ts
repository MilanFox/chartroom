import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { H3Event } from 'h3';
import { sessions } from '../db/schema';
import type { Store } from './store';

export const SESSION_COOKIE = 'chartroom_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionRecord = typeof sessions.$inferSelect;

export const setSessionCookie = (event: H3Event, token: string) => {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: isSecureRequest(event),
  });
};

export const createSession = (holderSlug: string | null) => {
  const token = randomBytes(32).toString('base64url');
  const at = nowIso();
  useStore().insert(sessions).values({
    id: hashSecret(token),
    holderSlug,
    createdAt: at,
    expiresAt: isoAfterSeconds(SESSION_MAX_AGE_SECONDS),
    lastSeenAt: at,
  }).run();
  return token;
};

export const findSession = (token: string): SessionRecord | null => {
  const store = useStore();
  const session = store.select().from(sessions).where(eq(sessions.id, hashSecret(token))).get();
  if (!session) return null;
  if (session.expiresAt <= nowIso()) {
    store.delete(sessions).where(eq(sessions.id, session.id)).run();
    return null;
  }
  const touched = { lastSeenAt: nowIso(), expiresAt: isoAfterSeconds(SESSION_MAX_AGE_SECONDS) };
  store.update(sessions).set(touched).where(eq(sessions.id, session.id)).run();
  return { ...session, ...touched };
};

export const deleteSession = (id: string) => {
  useStore().delete(sessions).where(eq(sessions.id, id)).run();
};

export const elevateSession = (id: string, until: string) => {
  useStore().update(sessions).set({ adminUntil: until }).where(eq(sessions.id, id)).run();
};

export const dropElevation = (id: string) => {
  useStore().update(sessions).set({ adminUntil: null }).where(eq(sessions.id, id)).run();
};

export const deleteSessionsForHolder = (holderSlug: string, store: Store = useStore()) => {
  store.delete(sessions).where(eq(sessions.holderSlug, holderSlug)).run();
};
