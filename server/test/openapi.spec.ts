import { describe, expect, it } from 'vitest';
import { apiClient, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';
import { ERROR_CODES } from '../utils/errors';
import { VERB_ROUTES } from '../../cli/src/chartroom';
import { ADAPTER_FILES } from '../utils/adapter';

type OpenApiDocument = {
  openapi: string
  servers: { url: string }[]
  paths: Record<string, Record<string, { summary: string, tags?: string[], description?: string, parameters?: { name: string, in: string }[], requestBody?: { content: Record<string, { schema: { properties: Record<string, unknown> } }> } }>>
  components: { schemas: Record<string, { properties: Record<string, { enum?: string[] }> }>, securitySchemes: Record<string, unknown> }
  security: Record<string, string[]>[]
};

describe('the OpenAPI document', () => {
  const server = useTestServer();

  let apiDocumentOnce: Promise<OpenApiDocument> | undefined;
  const apiDocument = () => {
    apiDocumentOnce ??= apiClient(server).request('GET', '/openapi.json').then(response => response.json() as Promise<OpenApiDocument>);
    return apiDocumentOnce;
  };

  let uiDocumentOnce: Promise<OpenApiDocument> | undefined;
  const uiDocument = () => {
    uiDocumentOnce ??= uiClient(server).request('GET', '/openapi.json').then(response => response.json() as Promise<OpenApiDocument>);
    return uiDocumentOnce;
  };

  it('is served unauthenticated on both mounts as JSON', async () => {
    const api = await apiClient(server).request('GET', '/openapi.json');
    const ui = await uiClient(server).request('GET', '/openapi.json');

    expect(api.status).toBe(200);
    expect(api.headers.get('content-type')).toMatch(/application\/json/);
    expect(await api.json()).toMatchObject({ openapi: '3.1.0', info: { title: 'Chartroom' } });
    expect(ui.status).toBe(200);
    expect(await ui.json()).toMatchObject({ openapi: '3.1.0' });
  });

  it('lists the route table under the api server', async () => {
    const document = await apiDocument();

    expect(document.servers[0]!.url).toMatch(/\/api\/v1$/);
    expect(document.paths['/me']!.get?.summary).toBeTruthy();
    expect(document.paths['/holders']!.get?.summary).toBeTruthy();
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(['/issues', '/issues/{number}', '/issues/{number}/body/append', '/issues/{number}/changes']));
    expect(Object.keys(document.paths['/issues']!)).toEqual(['get', 'post']);
    expect(Object.keys(document.paths['/issues/{number}']!)).toEqual(['get', 'patch', 'delete']);
    expect(Object.keys(document.paths['/issues/{number}/body/append']!)).toEqual(['post']);
    expect(Object.keys(document.paths['/issues/{number}/changes']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/issues/{number}/claim']!)).toEqual(['post']);
    expect(Object.keys(document.paths['/issues/{number}/assignee']!)).toEqual(['delete']);
    expect(Object.keys(document.paths['/issues/{number}/close']!)).toEqual(['post']);
    expect(Object.keys(document.paths['/issues/{number}/reopen']!)).toEqual(['post']);
    expect(Object.keys(document.paths['/issues/{number}/comments']!)).toEqual(['get', 'post']);
    expect(Object.keys(document.paths['/issues/{number}/comments/{id}']!)).toEqual(['patch', 'delete']);
    expect(Object.keys(document.paths['/issues/{number}/labels/{label}']!)).toEqual(['put', 'delete']);
    expect(Object.keys(document.paths['/issues/{number}/blockers/{blocker}']!)).toEqual(['put', 'delete']);
    expect(Object.keys(document.paths['/issues/{number}/links']!)).toEqual(['get', 'post']);
    expect(Object.keys(document.paths['/issues/{number}/links/{id}']!)).toEqual(['patch', 'delete']);
    expect(Object.keys(document.paths['/issues/{number}/research']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/issues/{number}/research/{slug}']!)).toEqual(['get', 'put']);
    expect(Object.keys(document.paths['/efforts']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/efforts/{handle}']!)).toEqual(['get']);
    expect(document.paths['/admin/closed-efforts']).toBeUndefined();
    expect(Object.keys(document.paths['/efforts/{handle}/artifacts.md']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/labels']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/instance']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/instance/adapter/issue-tracker.md']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/instance/adapter/triage-labels.md']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/environments']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/credential-pointers']!)).toEqual(['get']);
    expect(document.paths['/login']).toBeUndefined();
    expect(document.paths['/label-groups']).toBeUndefined();
    expect(document.paths['/labels/free-form']).toBeUndefined();
    expect(document.paths['/snapshots']).toBeUndefined();
    expect(document.security).toEqual([{ bearer: [] }]);
    expect(document.components.securitySchemes).toEqual({ bearer: { type: 'http', scheme: 'bearer' } });
  });

  it('lists every route a CLI verb maps to', async () => {
    const document = await apiDocument();

    const documented = VERB_ROUTES.filter(({ method, path }) => document.paths[path]?.[method]?.summary);

    expect(documented).toEqual(VERB_ROUTES);
  });

  it('matches every CLI verb route to the query names and body fields of its operation', async () => {
    const document = await apiDocument();

    const drift = VERB_ROUTES.flatMap(({ method, path, query, bodyFields }) => {
      const operation = document.paths[path]![method]!;
      const documentedQuery = (operation.parameters ?? []).filter(parameter => parameter.in === 'query').map(parameter => parameter.name);
      const documentedBody = Object.keys(operation.requestBody?.content['application/json']?.schema.properties ?? {});
      return [
        ...[...query].sort().join() === [...documentedQuery].sort().join() ? [] : [`${method} ${path} query ${query} vs ${documentedQuery}`],
        ...bodyFields.every(field => documentedBody.includes(field)) ? [] : [`${method} ${path} body ${bodyFields} vs ${documentedBody}`],
      ];
    });

    expect(drift).toEqual([]);
  });

  it('maps the adapter verb to every adapter file', () => {
    const adapterPaths = VERB_ROUTES.filter(({ command }) => command === 'adapter').map(({ path }) => path);

    expect(adapterPaths).toEqual(ADAPTER_FILES.map(file => `/instance/adapter/${file}`));
  });

  it('gives every api operation a written summary and a tag', async () => {
    const document = await apiDocument();

    const undescribed = Object.entries(document.paths).flatMap(([path, operations]) =>
      Object.entries(operations)
        .filter(([method, { summary, tags }]) => summary === `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}` || !tags?.length)
        .map(([method]) => `${method.toUpperCase()} ${path}`));

    expect(undescribed).toEqual([]);
  });

  it('has its reference page served as HTML without a session', async () => {
    const page = await server.fetch('/api/docs', { redirect: 'manual' });

    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('adds the UI-only routes under the ui server', async () => {
    const document = await uiDocument();

    expect(document.servers[0]!.url).toMatch(/\/ui$/);
    expect(document.paths['/me']!.get).toBeDefined();
    expect(document.paths['/login']!.post?.summary).toBeTruthy();
    expect(document.paths['/holders/{slug}/rotate']!.post?.summary).toBeTruthy();
    expect(Object.keys(document.paths['/instance']!)).toEqual(['get', 'patch']);
    expect(Object.keys(document.paths['/environments']!)).toEqual(['get', 'post']);
    expect(Object.keys(document.paths['/environments/{id}']!)).toEqual(['patch', 'delete']);
    expect(Object.keys(document.paths['/credential-pointers']!)).toEqual(['get', 'post']);
    expect(Object.keys(document.paths['/credential-pointers/{id}']!)).toEqual(['patch', 'delete']);
    expect(Object.keys(document.paths['/label-groups']!)).toEqual(['post']);
    expect(Object.keys(document.paths['/label-groups/order']!)).toEqual(['put']);
    expect(Object.keys(document.paths['/label-groups/{id}']!)).toEqual(['patch', 'delete']);
    expect(Object.keys(document.paths['/label-groups/{id}/labels']!)).toEqual(['post']);
    expect(Object.keys(document.paths['/label-groups/{id}/labels/order']!)).toEqual(['put']);
    expect(Object.keys(document.paths['/label-groups/{id}/labels/{label}']!)).toEqual(['patch', 'delete']);
    expect(Object.keys(document.paths['/labels/free-form']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/snapshots']!)).toEqual(['get', 'post']);
    expect(Object.keys(document.paths['/snapshots/{name}']!)).toEqual(['get', 'delete']);
    expect(Object.keys(document.paths['/admin/closed-efforts']!)).toEqual(['get']);
    expect(Object.keys(document.paths['/efforts/{handle}']!)).toEqual(['get', 'delete']);
    expect(document.security).toEqual([{ session: [] }]);
    expect(document.components.securitySchemes).toEqual({ session: { type: 'apiKey', in: 'cookie', name: 'chartroom_session' } });
  });

  it('describes the error envelope with the six codes', async () => {
    const document = await apiDocument();

    const envelope = document.components.schemas.Error!.properties.error as { properties: Record<string, { enum?: string[] }>, required: string[] };
    expect(envelope.properties.code!.enum).toEqual(ERROR_CODES);
    expect(envelope.properties.details).toEqual({ type: 'object' });
    expect(envelope.required).toEqual(['code', 'message']);
  });

  it('is public for GET only', async () => {
    const admin = uiClient(server);
    await admin.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
    const { body: holder } = await admin.createHolder('api-user');

    const anonymous = await apiClient(server).json('POST', '/openapi.json');
    const authenticated = await apiClient(server, holder.secret).json('POST', '/openapi.json');

    expect(anonymous).toMatchObject({ status: 401, body: { error: { code: 'unauthenticated' } } });
    expect(authenticated).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
  });

  describe('response shapes', () => {
    type Schema = { type?: string | string[], properties?: Record<string, Schema>, required?: string[], items?: Schema, additionalProperties?: Schema, oneOf?: Schema[] };

    const schemaOf = (document: OpenApiDocument, [method, path]: [string, string], status: string) => {
      const operation = document.paths[path]![method] as unknown as { responses: Record<string, { content: Record<string, { schema: Schema }> }> };
      return operation.responses[status]!.content['application/json']!.schema;
    };

    const drift = (schema: Schema, value: unknown, at: string): string[] => {
      if (schema.oneOf) {
        const matching = schema.oneOf.map(option => drift(option, value, at));
        return matching.some(found => found.length === 0) ? [] : matching.flat();
      }
      if (Array.isArray(value)) return value.flatMap((item, index) => schema.items ? drift(schema.items, item, `${at}[${index}]`) : []);
      if (value === null || typeof value !== 'object') return [];
      const record = value as Record<string, unknown>;
      const properties = schema.properties ?? {};
      return [
        ...(schema.required ?? []).filter(key => !(key in record)).map(key => `${at}: required ${key} is missing`),
        ...Object.keys(record).filter(key => !schema.additionalProperties && !(key in properties)).map(key => `${at}: ${key} is not in properties`),
        ...Object.entries(record).flatMap(([key, nested]) => properties[key] ? drift(properties[key], nested, `${at}.${key}`) : []),
      ];
    };

    it('match what the handlers return', async () => {
      const admin = uiClient(server);
      await admin.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
      await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
      const { body: holder } = await admin.createHolder('shape-user', 'Shape User');
      const api = apiClient(server, holder.secret);
      const create = async (body: Record<string, unknown>) => (await api.json('POST', '/issues', { body })).body;
      const effort = await create({ kind: 'effort', title: 'Shapes', name: 'shapes' });
      const ticket = await create({ kind: 'ticket', title: 'Shaped', parent: effort.number, labels: ['needs-triage'] });
      const blocker = await create({ kind: 'ticket', title: 'Blocker', parent: effort.number });
      await api.json('PUT', `/issues/${ticket.number}/blockers/${blocker.number}`);
      await api.json('POST', `/issues/${ticket.number}/links`, { body: { role: 'artifact', type: 'branch', url: 'https://git.example/shape', title: 'Shape' } });
      await api.json('POST', `/issues/${ticket.number}/comments`, { body: { body: 'A comment' } });
      const created = await api.json('PUT', `/issues/${ticket.number}/research/shape`, { body: { body: '# Shape' } });
      const replaced = await api.json('PUT', `/issues/${ticket.number}/research/shape`, { body: { body: '# Shape, again' } });
      await api.json('POST', `/issues/${ticket.number}/claim`);
      await api.json('POST', `/issues/${ticket.number}/close`, { body: { comment: 'Resolved' } });

      const member = uiClient(server);
      await member.login(holder.secret);

      const documents = { api: await apiDocument(), ui: await uiDocument() };
      const clients = { api: (method: string, path: string) => api.json(method, path), ui: (method: string, path: string) => member.json(method, path) };
      const checks = [
        { path: '/me', url: '/me' },
        { path: '/holders', url: '/holders' },
        { path: '/issues', url: '/issues' },
        { path: '/issues/{number}', url: `/issues/${ticket.number}` },
        { path: '/efforts/{handle}', url: '/efforts/shapes' },
        { path: '/issues/{number}/comments', url: `/issues/${ticket.number}/comments` },
        { path: '/issues/{number}/links', url: `/issues/${ticket.number}/links` },
        { path: '/issues/{number}/changes', url: `/issues/${ticket.number}/changes` },
        { path: '/issues/{number}/research', url: `/issues/${ticket.number}/research` },
        { path: '/issues/{number}/research/{slug}', url: `/issues/${ticket.number}/research/shape` },
      ];

      for (const origin of ['api', 'ui'] as const) {
        for (const { path, url } of checks) {
          const { body } = await clients[origin]('GET', url);
          expect(drift(schemaOf(documents[origin], ['get', path], '200'), body, `${origin} get ${path}`)).toEqual([]);
        }
      }
      expect(drift(schemaOf(documents.api, ['put', '/issues/{number}/research/{slug}'], '201'), created.body, 'api put research created')).toEqual([]);
      expect(drift(schemaOf(documents.api, ['put', '/issues/{number}/research/{slug}'], '200'), replaced.body, 'api put research replaced')).toEqual([]);
      expect(drift(schemaOf(documents.ui, ['post', '/holders'], '201'), holder, 'ui post /holders')).toEqual([]);
      const login = await uiClient(server).login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
      expect(drift(schemaOf(documents.ui, ['post', '/login'], '200'), login.body, 'ui post /login')).toEqual([]);
      expect(drift(schemaOf(documents.ui, ['post', '/elevate'], '200'), (await admin.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD)).body, 'ui post /elevate')).toEqual([]);
    });
  });
});
