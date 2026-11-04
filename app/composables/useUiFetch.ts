interface UiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, string | number>
}

const endSession = async () => {
  const session = useSessionStore();
  if (!session.me) return;
  session.me = null;
  await navigateTo(LOGIN_PATH);
};

export const useUiFetch = () => {
  const requestFetch = useRequestFetch();
  const nuxtApp = useNuxtApp();
  return async <T>(path: string, options: UiFetchOptions = {}) => {
    try {
      return await requestFetch(`/ui${path}`, options as Parameters<typeof requestFetch>[1]) as T;
    }
    catch (error) {
      if (path !== '/login' && apiErrorCode(error) === 'unauthenticated') await nuxtApp.runWithContext(endSession);
      throw error;
    }
  };
};
