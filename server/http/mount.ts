import type { H3Event } from 'h3';
import type { Principal } from '../utils/principal';
import { routeTable } from './table';
import type { Handler, RouteMethod, TableRoute } from './table';

export interface PublicRoute {
  method: RouteMethod
  path: string
  public: true
  handler: Handler<[H3Event]>
}

export type MountRoute = TableRoute | PublicRoute;

interface MountOptions {
  origin: Principal['origin']
  resolvePrincipal: Handler<[H3Event], Principal>
  extraRoutes?: MountRoute[]
}

const PREFIXES = { api: '/api/v1', ui: '/ui' };
const READ_METHODS = new Set(['GET', 'HEAD']);

const isRead = (event: H3Event) => READ_METHODS.has(event.method);

const assertJsonBody = (event: H3Event) => {
  const hasBody = Number(getRequestHeader(event, 'content-length')) > 0 || Boolean(getRequestHeader(event, 'transfer-encoding'));
  if (hasBody && !getRequestHeader(event, 'content-type')?.startsWith('application/json')) throw unsupportedMediaType();
};

const assertSameOrigin = (event: H3Event) => {
  if (getRequestHeader(event, 'origin') !== baseUrl(event)) throw forbidden('writes must originate from this site');
};

const renderError = (event: H3Event, error: unknown) => {
  if (isError(error) && (error.statusCode === 404 || error.statusCode === 405)) return renderError(event, notFound('no such route'));
  const apiError = error instanceof ApiError ? error : null;
  if (!apiError) process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  setResponseStatus(event, apiError?.status ?? 500);
  return apiError?.toBody() ?? { error: { code: 'internal', message: 'internal error' } };
};

const routeHandler = (route: MountRoute, viewerWall: boolean) => defineEventHandler((event) => {
  if ('public' in route) return route.handler(event);
  const principal = event.context.principal as Principal;
  if (viewerWall && principal.viewer && route.method !== 'get') throw forbidden('viewer sessions are read-only');
  return route.handler(event, principal);
});

export const createMount = ({ origin, resolvePrincipal, extraRoutes = [] }: MountOptions) => {
  const prefix = PREFIXES[origin];
  const publicPaths = new Set(extraRoutes.filter(route => 'public' in route).map(route => `${route.method.toUpperCase()} ${prefix}${route.path}`));
  const router = createRouter({ preemptive: true });
  for (const route of routeTable) router.add(route.path, routeHandler(route, origin === 'ui'), route.method);
  for (const route of extraRoutes) router.add(route.path, routeHandler(route, false), route.method);
  const dispatch = useBase(prefix, router.handler);
  return defineEventHandler(async (event) => {
    try {
      assertJsonBody(event);
      if (!publicPaths.has(`${event.method} ${event.path}`)) event.context.principal = resolvePrincipal(event);
      if (origin === 'ui' && !isRead(event)) assertSameOrigin(event);
      return await dispatch(event);
    }
    catch (error) {
      return renderError(event, error);
    }
  });
};
