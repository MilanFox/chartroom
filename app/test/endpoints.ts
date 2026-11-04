import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach } from 'vitest';

export const useEndpoints = () => {
  const unregister: (() => void)[] = [];
  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });
  return (...args: Parameters<typeof registerEndpoint>) => {
    unregister.push(registerEndpoint(...args));
  };
};

export const requestOf = (event: unknown) => (event as { web: { request: Request } }).web.request;

export const searchOf = (event: unknown) => new URL(requestOf(event).url).searchParams;

type ApiFailureInit = { code: string, message: string, field?: string, details?: Record<string, unknown> };

const errorBody = ({ code, message, field, details }: ApiFailureInit) => ({ error: { code, message, ...(field ? { field } : {}), ...(details ? { details } : {}) } });

export const apiFailure = (status: number, init: ApiFailureInit) => () =>
  new Response(JSON.stringify(errorBody(init)), { status, headers: { 'content-type': 'application/json' } });

export const fetchFailure = (init: ApiFailureInit) => ({ data: errorBody(init) });
