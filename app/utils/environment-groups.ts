import type { CredentialPointer, Environment } from '~/types/api';

export const environmentGroups = <E extends Pick<Environment, 'id' | 'name' | 'url' | 'notes'>, P extends Pick<CredentialPointer, 'environment'>>(environments: E[], pointers: P[], anyLabel: string) => {
  const bound = environments.map(environment => ({
    key: `environment-${environment.id}`,
    environment,
    name: environment.name,
    url: environment.url,
    notes: environment.notes,
    pointers: pointers.filter(pointer => pointer.environment === environment.id),
  }));
  const unbound = pointers.filter(pointer => pointer.environment === null);
  if (!unbound.length) return bound;
  return [...bound, { key: 'any', environment: null, name: anyLabel, url: null, notes: null, pointers: unbound }];
};
