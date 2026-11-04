import type { Page } from '~/types/api';

interface UiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, string | number | string[]>
  headers?: Record<string, string>
}

const PASSWORD_PATHS = ['/login', '/elevate'];

const PAGE_LIMIT = 200;

const endSessionIfSignedIn = async () => {
  const session = useSessionStore();
  if (session.me) await session.endSession();
};

export const useUiFetch = () => {
  const requestFetch = useRequestFetch();
  const nuxtApp = useNuxtApp();
  return async <T>(path: string, options: UiFetchOptions = {}) => {
    try {
      return await requestFetch(`/ui${path}`, options as Parameters<typeof requestFetch>[1]) as T;
    }
    catch (error) {
      if (!PASSWORD_PATHS.includes(path) && apiErrorCode(error) === 'unauthenticated') await nuxtApp.runWithContext(endSessionIfSignedIn);
      throw error;
    }
  };
};

export const useAllPages = () => {
  const uiFetch = useUiFetch();
  return async <T>(path: string, query: Record<string, string | number> = {}) => {
    const items: T[] = [];
    let cursor: string | null = null;
    do {
      const page: Page<T> = await uiFetch<Page<T>>(path, { query: { ...query, limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) } });
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  };
};

export const useWriteThen = (reload: () => Promise<unknown>) => {
  const uiFetch = useUiFetch();
  return async <T = void>(path: string, options: UiFetchOptions) => {
    const written = await uiFetch<T>(path, options);
    await reload();
    return written;
  };
};
