import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiFailure, requestOf, useEndpoints } from '~/test/endpoints';
import { apiErrorCode } from '~/utils/api-error';
import { useSessionStore } from './session';

const milan = { slug: 'milan', displayName: 'Milan', viewer: false, admin: null };
const endpoint = useEndpoints();

const requestJson = (event: unknown) => requestOf(event).json();

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('loads who is signed in from /ui/me', async () => {
    endpoint('/ui/me', () => milan);
    const session = useSessionStore();

    await session.load();

    expect(session.me).toEqual(milan);
    expect(session.loaded).toBe(true);
    expect(session.isViewer).toBe(false);
  });

  it('treats an unauthenticated /ui/me as nobody signed in', async () => {
    endpoint('/ui/me', apiFailure(401, { code: 'unauthenticated', message: 'unauthenticated' }));
    const session = useSessionStore();

    await session.load();

    expect(session.me).toBeNull();
    expect(session.loaded).toBe(true);
  });

  it('signs in with whatever secret the field held, the server deciding Viewer or holder', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/login', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestJson(event));
        return { slug: null, displayName: null, viewer: true, admin: null };
      }
    });
    const session = useSessionStore();

    await session.login('the-viewer-password');

    expect(sent).toEqual([{ secret: 'the-viewer-password' }]);
    expect(session.isViewer).toBe(true);
  });

  it('rejects a failed login with the API error code and stays signed out', async () => {
    endpoint('/ui/login', { method: 'POST', handler: apiFailure(429, { code: 'rate-limited', message: 'rate-limited' }) });
    const session = useSessionStore();

    const failure = await session.login('wrong').catch(apiErrorCode);

    expect(failure).toBe('rate-limited');
    expect(session.me).toBeNull();
  });

  it('shows the elevation end after elevating and none after dropping it', async () => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    endpoint('/ui/me', () => milan);
    endpoint('/ui/elevate', { method: 'POST', handler: () => ({ ...milan, admin: { until } }) });
    endpoint('/ui/elevate', { method: 'DELETE', handler: () => milan });
    const session = useSessionStore();
    await session.load();

    await session.elevate('the-admin-password');
    expect(session.adminUntil).toEqual(new Date(until));

    await session.dropElevation();
    expect(session.adminUntil).toBeNull();
  });

  it('forgets who was signed in on logout', async () => {
    endpoint('/ui/me', () => milan);
    endpoint('/ui/logout', { method: 'POST', handler: () => new Response(null, { status: 204 }) });
    const session = useSessionStore();
    await session.load();

    await session.logout();

    expect(session.me).toBeNull();
  });
});
