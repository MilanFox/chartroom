import type { H3Event } from 'h3';
import type { EnvironmentRecord, PointerRecord } from '../../utils/environments';
import type { Principal } from '../../utils/principal';

export const canSeePointers = (principal: Principal) => !principal.viewer || isElevated(principal);

export const toPointer = (pointer: PointerRecord) => ({
  id: pointer.id,
  label: pointer.label,
  accountName: pointer.accountName,
  whereToFind: pointer.whereToFind,
  environment: pointer.environment,
});

export const toEnvironment = (environment: EnvironmentRecord, pointers: PointerRecord[] | null) => ({
  id: environment.id,
  name: environment.name,
  url: environment.url,
  notes: environment.notes,
  ...(pointers ? { credentialPointers: pointers.filter(pointer => pointer.environment === environment.id).map(toPointer) } : {}),
});

export const environmentList = (_event: H3Event, principal: Principal) => {
  const pointers = canSeePointers(principal) ? listPointers() : null;
  return listEnvironments().map(environment => toEnvironment(environment, pointers));
};

export const pointerList = (_event: H3Event, principal: Principal) => {
  if (!canSeePointers(principal)) throw forbidden('credential pointers require a holder session or elevation');
  return listPointers().map(toPointer);
};

const POINTER_PROPERTIES = {
  id: { type: 'integer' },
  label: { type: 'string' },
  accountName: { type: 'string' },
  whereToFind: { type: 'string' },
  environment: { type: ['integer', 'null'], description: 'The bound Environment id, null for any environment' },
};

export const POINTER_SCHEMA = { type: 'object', properties: POINTER_PROPERTIES, required: Object.keys(POINTER_PROPERTIES) };

const ENVIRONMENT_PROPERTIES = {
  id: { type: 'integer' },
  name: { type: 'string' },
  url: { type: 'string' },
  notes: { type: ['string', 'null'] },
  credentialPointers: { type: 'array', items: POINTER_SCHEMA, description: 'Omitted for a non-elevated Viewer' },
};

export const ENVIRONMENT_SCHEMA = { type: 'object', properties: ENVIRONMENT_PROPERTIES, required: ['id', 'name', 'url', 'notes'] };
