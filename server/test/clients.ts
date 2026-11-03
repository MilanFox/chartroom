import { TEST_PASSWORDS } from './harness';
import type { LaunchedServer } from './harness';

interface RequestOptions {
  body?: unknown
  headers?: Record<string, string>
  rawBody?: string
}

export type Client = ReturnType<typeof uiClient>;

const jsonRequest = (method: string, options: RequestOptions) => {
  const headers: Record<string, string> = { ...options.headers };
  let body: string | undefined;
  if (options.rawBody !== undefined) body = options.rawBody;
  else if (options.body !== undefined) {
    headers['content-type'] ??= 'application/json';
    body = JSON.stringify(options.body);
  }
  return { method, headers, body };
};

export const uiClient = (server: LaunchedServer) => {
  let cookie: string | null = null;
  const request = async (method: string, path: string, options: RequestOptions = {}) => {
    const init = jsonRequest(method, { ...options, headers: { origin: server.baseUrl, ...options.headers } });
    if (cookie && !('cookie' in init.headers)) init.headers.cookie = cookie;
    const response = await server.fetch(`/ui${path}`, init);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.startsWith('chartroom_session=;') ? null : setCookie.split(';')[0]!;
    return response;
  };
  const json = async (method: string, path: string, options: RequestOptions = {}) => {
    const response = await request(method, path, options);
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  };
  return {
    request,
    json,
    get cookie() {
      return cookie;
    },
    login: (secret: string, headers?: Record<string, string>) => json('POST', '/login', { body: { secret }, headers }),
    elevate: (password: string) => json('POST', '/elevate', { body: { password } }),
    createHolder: (slug: string, displayName?: string) => json('POST', '/holders', { body: { slug, displayName } }),
  };
};

export const apiClient = (server: LaunchedServer, secret?: string) => {
  const request = (method: string, path: string, options: RequestOptions = {}) => {
    const headers = secret ? { authorization: `Bearer ${secret}`, ...options.headers } : options.headers;
    return server.fetch(`/api/v1${path}`, jsonRequest(method, { ...options, headers }));
  };
  const json = async (method: string, path: string, options: RequestOptions = {}) => {
    const response = await request(method, path, options);
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  };
  return { request, json };
};

export const holderSecret = async (server: LaunchedServer, slug = 'api-user', displayName?: string) => {
  const admin = uiClient(server);
  await admin.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
  await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
  const { body } = await admin.createHolder(slug, displayName);
  return body.secret as string;
};
