import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import { useSessionStore } from '~/stores/session';
import { useUiFetch } from './useUiFetch';

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateToMock);

const milan = { slug: 'milan', displayName: 'Milan', viewer: false, admin: null };
const endpoint = useEndpoints();
const unauthenticated = apiFailure(401, { code: 'unauthenticated', message: 'unauthenticated' });

describe('useUiFetch', () => {
  beforeEach(() => {
    navigateToMock.mockReset();
  });

  it('signs the session out and returns to the login page when a call finds the session gone', async () => {
    endpoint('/ui/efforts', unauthenticated);
    const session = useSessionStore();
    session.me = milan;

    await expect(useUiFetch()('/efforts')).rejects.toThrow();

    expect(session.me).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith('/login');
  });

  it('leaves a wrong secret on the login page to the login form', async () => {
    endpoint('/ui/login', { method: 'POST', handler: unauthenticated });
    const session = useSessionStore();
    session.me = milan;

    await expect(useUiFetch()('/login', { method: 'POST', body: { secret: 'wrong' } })).rejects.toThrow();

    expect(session.me).toEqual(milan);
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it('leaves a wrong admin password to the elevation prompt', async () => {
    endpoint('/ui/elevate', { method: 'POST', handler: unauthenticated });
    const session = useSessionStore();
    session.me = milan;

    await expect(useUiFetch()('/elevate', { method: 'POST', body: { password: 'wrong' } })).rejects.toThrow();

    expect(session.me).toEqual(milan);
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
