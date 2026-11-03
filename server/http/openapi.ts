import { ERROR_CODES } from '../utils/errors';
import type { MountRoute } from './mount';
import { routeTable } from './table';
import type { JsonSchema, OperationMeta } from './table';

type MountOrigin = 'api' | 'ui';

interface DocumentOptions {
  baseUrl: string
  origin: MountOrigin
  extraRoutes: MountRoute[]
}

export const MOUNT_PREFIXES: Record<MountOrigin, string> = { api: '/api/v1', ui: '/ui' };

const SECURITY_SCHEMES: Record<MountOrigin, Record<string, JsonSchema>> = {
  api: { bearer: { type: 'http', scheme: 'bearer' } },
  ui: { session: { type: 'apiKey', in: 'cookie', name: 'chartroom_session' } },
};

const ERROR_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: { code: { type: 'string', enum: [...ERROR_CODES] }, message: { type: 'string' }, field: { type: 'string' } },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
};

const errorContent = { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } };

const templatePath = (path: string) => path.replace(/:(\w+)/g, '{$1}');

const pathParameters = (path: string, declared: NonNullable<OperationMeta['parameters']>) =>
  [...path.matchAll(/:(\w+)/g)]
    .map(([, name]) => name!)
    .filter(name => !declared.some(parameter => parameter.in === 'path' && parameter.name === name))
    .map(name => ({ name, in: 'path', required: true, schema: { type: 'string' } }));

const response = (status: string, { description, schema }: OperationMeta['responses'][string]) => {
  if (schema) return { description, content: { 'application/json': { schema } } };
  return Number(status) >= 400 ? { description, content: errorContent } : { description };
};

const operation = (route: MountRoute) => {
  const meta = route.openapi;
  const parameters = [...pathParameters(route.path, meta?.parameters ?? []), ...(meta?.parameters ?? [])];
  const responses = Object.fromEntries(Object.entries(meta?.responses ?? {}).map(([status, given]) => [status, response(status, given)]));
  return {
    summary: meta?.summary ?? `${route.method.toUpperCase()} ${route.path}`,
    ...(meta?.tags ? { tags: meta.tags } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(meta?.requestBody ? { requestBody: { required: true, content: { 'application/json': { schema: meta.requestBody } } } } : {}),
    responses: { ...responses, default: { $ref: '#/components/responses/Error' } },
    ...('public' in route ? { security: [] } : {}),
  };
};

export const buildOpenApiDocument = ({ baseUrl, origin, extraRoutes }: DocumentOptions) => {
  const paths: Record<string, Record<string, ReturnType<typeof operation>>> = {};
  for (const route of [...routeTable, ...extraRoutes]) {
    paths[templatePath(route.path)] ??= {};
    paths[templatePath(route.path)]![route.method] = operation(route);
  }
  const [scheme] = Object.keys(SECURITY_SCHEMES[origin]);
  return {
    openapi: '3.1.0',
    info: { title: 'Chartroom', version: useRuntimeConfig().version },
    servers: [{ url: `${baseUrl}${MOUNT_PREFIXES[origin]}` }],
    paths,
    components: {
      schemas: { Error: ERROR_SCHEMA },
      responses: { Error: { description: 'The error envelope', content: errorContent } },
      securitySchemes: SECURITY_SCHEMES[origin],
    },
    security: [{ [scheme!]: [] }],
  };
};
