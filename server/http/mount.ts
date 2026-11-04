import type { H3Event } from 'h3';
import type { Caller } from '../utils/caller';
import { buildOpenApiDocument, MOUNT_PREFIXES } from './openapi';
import { routeTable } from './table';
import type { Handler, OperationMeta, RouteMethod, TableRoute } from './table';

interface DescribedRoute {
  method: RouteMethod
  path: string
  openapi?: OperationMeta
}

export interface PublicRoute extends DescribedRoute {
  public: true
  handler: Handler<[H3Event]>
}

export interface ExtraRoute extends DescribedRoute {
  elevated?: true
  handler: TableRoute['handler']
}

export type MountRoute = ExtraRoute | PublicRoute;

interface MountOptions {
  origin: Caller['origin']
  resolveCaller: Handler<[H3Event], Caller>
  extraRoutes?: MountRoute[]
}

const READ_METHODS = new Set(['GET', 'HEAD']);

const isRead = (event: H3Event) => READ_METHODS.has(event.method);

const assertJsonBody = (event: H3Event) => {
  const hasBody = Number(getRequestHeader(event, 'content-length')) > 0 || Boolean(getRequestHeader(event, 'transfer-encoding'));
  if (hasBody && !getRequestHeader(event, 'content-type')?.startsWith('application/json')) throw unsupportedMediaType();
};

const assertSameOrigin = (event: H3Event) => {
  if (getRequestHeader(event, 'origin') !== new URL(baseUrl(event)).origin) throw forbidden('writes must originate from this site');
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
  const caller = event.context.caller as Caller;
  if (viewerWall && caller.viewer && route.method !== 'get') throw forbidden('viewer sessions are read-only');
  if (route.elevated && !isElevated(caller)) throw forbidden('admin writes require elevation');
  return route.handler(event, caller);
});

const withOpenApiRoute = (origin: Caller['origin'], extraRoutes: MountRoute[]) => {
  const mountRoutes: MountRoute[] = [...extraRoutes];
  mountRoutes.push({
    method: 'get',
    path: '/openapi.json',
    public: true,
    handler: (event: H3Event) => buildOpenApiDocument({ baseUrl: baseUrl(event), origin, extraRoutes: mountRoutes }),
    openapi: { summary: 'This OpenAPI document', tags: ['meta'], responses: { 200: { description: 'The document', schema: { type: 'object' } } } },
  });
  return mountRoutes;
};

export const createMount = ({ origin, resolveCaller, extraRoutes = [] }: MountOptions) => {
  const prefix = MOUNT_PREFIXES[origin];
  const mountRoutes = withOpenApiRoute(origin, extraRoutes);
  const publicPaths = new Set(mountRoutes.filter(route => 'public' in route).map(route => `${route.method.toUpperCase()} ${prefix}${route.path}`));
  const router = createRouter({ preemptive: true });
  for (const route of routeTable) router.add(route.path, routeHandler(route, origin === 'ui'), route.method);
  for (const route of mountRoutes) router.add(route.path, routeHandler(route, false), route.method);
  const dispatch = useBase(prefix, router.handler);
  return defineEventHandler(async (event) => {
    try {
      assertJsonBody(event);
      if (!publicPaths.has(`${event.method} ${getRequestURL(event).pathname}`)) event.context.caller = resolveCaller(event);
      if (origin === 'ui' && !isRead(event)) assertSameOrigin(event);
      return await dispatch(event);
    }
    catch (error) {
      return renderError(event, error);
    }
  });
};
