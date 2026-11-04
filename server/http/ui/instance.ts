import type { H3Event } from 'h3';
import type { JsonObject } from '../../utils/body';
import type { EnvironmentFields, EnvironmentRecord, PointerFields, PointerRecord } from '../../utils/environments';
import type { SettingsPatch } from '../../utils/instance';
import type { Principal } from '../../utils/principal';
import { ENVIRONMENT_SCHEMA, POINTER_SCHEMA, toEnvironment, toPointer } from '../handlers/environments';
import { SETTINGS_PROPERTIES } from '../handlers/instance';
import { absoluteUrl } from '../handlers/links';
import type { MountRoute } from '../mount';

export const ELEVATION_REQUIRED = { description: 'Elevation required' };

const effortNameOf = (body: JsonObject) => {
  const effortName = nestedObject(body, 'effortName');
  const plural = effortName['effortName.plural'] ?? null;
  return { singular: requireText(effortName, 'effortName.singular'), plural: plural === null ? null : requireText(effortName, 'effortName.plural') };
};

const triageLabelsOf = (body: JsonObject) => {
  const given = nestedObject(body, 'triageLabels');
  const members = Object.keys(triageLabels());
  return Object.fromEntries(Object.keys(given).map((field) => {
    const id = field.slice('triageLabels.'.length);
    if (!members.includes(id)) throw invalid(`${id} is not a triage-state member`, field);
    return [id, requireText(given, field)];
  }));
};

const settingsPatch = (body: JsonObject): SettingsPatch => ({
  ...('projectName' in body ? { projectName: requireText(body, 'projectName') } : {}),
  ...('effortName' in body ? { effortName: effortNameOf(body) } : {}),
  ...('triageLabels' in body ? { triageLabels: triageLabelsOf(body) } : {}),
});

const settingsWrite = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  return writeInstanceSettings(settingsPatch(await readJsonObject(event)), actorSlug(principal));
};

const idParam = (event: H3Event) => {
  const raw = getRouterParam(event, 'id') ?? '';
  if (!/^\d+$/.test(raw)) throw notFound(`${raw} does not exist`);
  return Number(raw);
};

const secretFreeText = (body: JsonObject, field: string) => refuseSecretLooking(requireText(body, field), field);

const secretFreeNotes = (body: JsonObject) => {
  const value = optionalString(body, 'notes');
  return value?.trim() ? refuseSecretLooking(value, 'notes') : null;
};

const environmentId = (body: JsonObject) => {
  const value = body.environment ?? null;
  if (value !== null && !Number.isInteger(value)) throw invalid('environment must be an Environment id or null', 'environment');
  return value as number | null;
};

const environmentFields = (body: JsonObject): EnvironmentFields => ({
  ...('name' in body ? { name: requireText(body, 'name') } : {}),
  ...('url' in body ? { url: absoluteUrl(body) } : {}),
  ...('notes' in body ? { notes: secretFreeNotes(body) } : {}),
});

const pointerFields = (body: JsonObject): PointerFields => ({
  ...('label' in body ? { label: requireText(body, 'label') } : {}),
  ...('accountName' in body ? { accountName: secretFreeText(body, 'accountName') } : {}),
  ...('whereToFind' in body ? { whereToFind: secretFreeText(body, 'whereToFind') } : {}),
  ...('environment' in body ? { environment: environmentId(body) } : {}),
});

const adminEnvironment = (environment: EnvironmentRecord) => ({ ...toEnvironment(environment, listPointers()), updatedAt: environment.updatedAt, updatedBy: environment.updatedBy });

const adminPointer = (pointer: PointerRecord) => ({ ...toPointer(pointer), updatedAt: pointer.updatedAt, updatedBy: pointer.updatedBy });

const environmentCreate = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const body = await readJsonObject(event);
  const fields = { name: requireText(body, 'name'), url: absoluteUrl(body), notes: secretFreeNotes(body) };
  setResponseStatus(event, 201);
  return adminEnvironment(createEnvironment(fields, actorSlug(principal)));
};

const environmentUpdate = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const id = idParam(event);
  return adminEnvironment(updateEnvironment(id, environmentFields(await readJsonObject(event)), actorSlug(principal)));
};

const environmentDelete = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  deleteEnvironment(idParam(event));
  return sendNoContent(event);
};

const pointerCreate = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const body = await readJsonObject(event);
  const fields = { label: requireText(body, 'label'), accountName: secretFreeText(body, 'accountName'), whereToFind: secretFreeText(body, 'whereToFind'), environment: environmentId(body) };
  setResponseStatus(event, 201);
  return adminPointer(createPointer(fields, actorSlug(principal)));
};

const pointerUpdate = async (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  const id = idParam(event);
  return adminPointer(updatePointer(id, pointerFields(await readJsonObject(event)), actorSlug(principal)));
};

const pointerDelete = (event: H3Event, principal: Principal) => {
  requireElevation(principal);
  deletePointer(idParam(event));
  return sendNoContent(event);
};

const ADMIN_STAMP = { updatedAt: { type: 'string' }, updatedBy: { type: 'string' } };
const ADMIN_ENVIRONMENT_SCHEMA = { type: 'object', properties: { ...ENVIRONMENT_SCHEMA.properties, ...ADMIN_STAMP } };
const ADMIN_POINTER_SCHEMA = { type: 'object', properties: { ...POINTER_SCHEMA.properties, ...ADMIN_STAMP } };
const ENVIRONMENT_BODY = { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' }, notes: { type: ['string', 'null'] } } };
const POINTER_BODY = { type: 'object', properties: { label: { type: 'string' }, accountName: { type: 'string' }, whereToFind: { type: 'string' }, environment: { type: ['integer', 'null'] } } };
const SECRET_REFUSED = 'A blank or secret-looking value, a bad url or environment; field set';

export const instanceAdminRoutes: MountRoute[] = [
  {
    method: 'patch',
    path: '/instance',
    handler: settingsWrite,
    openapi: {
      summary: 'Write the Instance settings',
      tags: ['instance'],
      requestBody: {
        type: 'object',
        properties: {
          projectName: { type: 'string' },
          effortName: { type: 'object', properties: { singular: { type: 'string' }, plural: { type: ['string', 'null'], description: 'Omitted or null: the singular plus s' } }, required: ['singular'] },
          triageLabels: { type: 'object', description: 'Display label per triage-state member id', additionalProperties: { type: 'string' } },
        },
      },
      responses: {
        200: { description: 'The settings', schema: { type: 'object', properties: { ...SETTINGS_PROPERTIES, ...ADMIN_STAMP } } },
        400: { description: 'A blank value or an unknown triage-state member; field set' },
        403: ELEVATION_REQUIRED,
      },
    },
  },
  {
    method: 'post',
    path: '/environments',
    handler: environmentCreate,
    openapi: {
      summary: 'Create an Environment',
      tags: ['instance'],
      requestBody: { ...ENVIRONMENT_BODY, required: ['name', 'url'] },
      responses: { 201: { description: 'Environment', schema: ADMIN_ENVIRONMENT_SCHEMA }, 400: { description: SECRET_REFUSED }, 403: ELEVATION_REQUIRED },
    },
  },
  {
    method: 'patch',
    path: '/environments/:id',
    handler: environmentUpdate,
    openapi: {
      summary: 'Update an Environment',
      tags: ['instance'],
      requestBody: ENVIRONMENT_BODY,
      responses: { 200: { description: 'Environment', schema: ADMIN_ENVIRONMENT_SCHEMA }, 400: { description: SECRET_REFUSED }, 403: ELEVATION_REQUIRED, 404: { description: 'No such Environment' } },
    },
  },
  {
    method: 'delete',
    path: '/environments/:id',
    handler: environmentDelete,
    openapi: {
      summary: 'Delete an Environment; its pointers become unbound',
      tags: ['instance'],
      responses: { 204: { description: 'Deleted' }, 403: ELEVATION_REQUIRED, 404: { description: 'No such Environment' } },
    },
  },
  {
    method: 'post',
    path: '/credential-pointers',
    handler: pointerCreate,
    openapi: {
      summary: 'Create a Credential pointer',
      tags: ['instance'],
      requestBody: { ...POINTER_BODY, required: ['label', 'accountName', 'whereToFind'] },
      responses: { 201: { description: 'Credential pointer', schema: ADMIN_POINTER_SCHEMA }, 400: { description: SECRET_REFUSED }, 403: ELEVATION_REQUIRED, 404: { description: 'No such Environment' } },
    },
  },
  {
    method: 'patch',
    path: '/credential-pointers/:id',
    handler: pointerUpdate,
    openapi: {
      summary: 'Update a Credential pointer',
      tags: ['instance'],
      requestBody: POINTER_BODY,
      responses: { 200: { description: 'Credential pointer', schema: ADMIN_POINTER_SCHEMA }, 400: { description: SECRET_REFUSED }, 403: ELEVATION_REQUIRED, 404: { description: 'No such pointer or Environment' } },
    },
  },
  {
    method: 'delete',
    path: '/credential-pointers/:id',
    handler: pointerDelete,
    openapi: {
      summary: 'Delete a Credential pointer',
      tags: ['instance'],
      responses: { 204: { description: 'Deleted' }, 403: ELEVATION_REQUIRED, 404: { description: 'No such pointer' } },
    },
  },
];
