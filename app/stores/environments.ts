import { defineStore } from 'pinia';
import type { CredentialPointer, Environment, EnvironmentInput, PointerInput } from '~/types/api';

export const useEnvironmentsStore = defineStore('environments', () => {
  const uiFetch = useUiFetch();
  const environments = ref<Environment[]>([]);
  const pointers = ref<CredentialPointer[] | null>(null);

  const load = async () => {
    const [listed, allPointers] = await Promise.all([
      uiFetch<Environment[]>('/environments'),
      uiFetch<CredentialPointer[]>('/credential-pointers').catch((error) => {
        if (apiErrorCode(error) !== 'forbidden') throw error;
        return null;
      }),
    ]);
    environments.value = listed;
    pointers.value = allPointers;
  };

  const writeEnvironments = async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: Partial<EnvironmentInput> | Partial<PointerInput>) => {
    await uiFetch(path, { method, ...(body ? { body } : {}) });
    await load();
  };

  const createEnvironment = (input: EnvironmentInput) => writeEnvironments('/environments', 'POST', input);
  const updateEnvironment = (id: number, patch: Partial<EnvironmentInput>) => writeEnvironments(`/environments/${id}`, 'PATCH', patch);
  const deleteEnvironment = (id: number) => writeEnvironments(`/environments/${id}`, 'DELETE');
  const createPointer = (input: PointerInput) => writeEnvironments('/credential-pointers', 'POST', input);
  const updatePointer = (id: number, patch: Partial<PointerInput>) => writeEnvironments(`/credential-pointers/${id}`, 'PATCH', patch);
  const deletePointer = (id: number) => writeEnvironments(`/credential-pointers/${id}`, 'DELETE');

  return {
    environments,
    pointers,
    load,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    createPointer,
    updatePointer,
    deletePointer,
  };
});
