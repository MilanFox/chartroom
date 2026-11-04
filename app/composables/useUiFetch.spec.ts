import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '~/stores/session';
import { useUiFetch } from './useUiFetch';

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateToMock);

const milan = { slug: 'milan', displayName: 'Milan', viewer: false, admin: null };
const unregister: (() => void)[] = [];
const unauthenticated = () =>
  new Response(JSON.stringify({ error: { code: 'unauthenticated', message: 'unauthenticated' } }), { status: 401, headers: { 'content-type': 'application/json' } });

describe('useUiFetch', () => {
  beforeEach(() => {
    navigateToMock.mockReset();
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('signs the session out and returns to the login page when a call finds the session gone', async () => {
    unregister.push(registerEndpoint('/ui/efforts', unauthenticated));
    const session = useSessionStore();
    session.me = milan;

    await expect(useUiFetch()('/efforts')).rejects.toThrow();

    expect(session.me).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith('/login');
  });

  it('leaves a wrong secret on the login page to the login form', async () => {
    unregister.push(registerEndpoint('/ui/login', { method: 'POST', handler: unauthenticated }));
    const session = useSessionStore();
    session.me = milan;

    await expect(useUiFetch()('/login', { method: 'POST', body: { secret: 'wrong' } })).rejects.toThrow();

    expect(session.me).toEqual(milan);
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
