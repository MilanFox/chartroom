import { defineStore } from 'pinia';
import type { CredentialPointer, Environment, EnvironmentInput, HolderSecret, PointerInput, RosterHolder, RuntimeSettings, SettingsInput, Snapshot } from '~/types/api';

export const useAdminStore = defineStore('admin', () => {
  const uiFetch = useUiFetch();
  const instanceStore = useInstanceStore();
  const labelGroupsStore = useLabelGroupsStore();
  const environments = ref<Environment[]>([]);
  const pointers = ref<CredentialPointer[] | null>(null);
  const holders = ref<RosterHolder[] | null>(null);
  const runtimeSettings = ref<RuntimeSettings | null>(null);
  const firstRun = ref<boolean | null>(null);
  const snapshots = ref<Snapshot[] | null>(null);

  const unlessForbidden = <T>(read: Promise<T>) => read.catch((error) => {
    if (apiErrorCode(error) !== 'forbidden') throw error;
    return null;
  });

  const loadEnvironments = async () => {
    const [listed, allPointers] = await Promise.all([uiFetch<Environment[]>('/environments'), unlessForbidden(uiFetch<CredentialPointer[]>('/credential-pointers'))]);
    environments.value = listed;
    pointers.value = allPointers;
  };

  const loadHolders = async () => {
    holders.value = await unlessForbidden(uiFetch<RosterHolder[]>('/holders'));
  };

  const loadSnapshots = async () => {
    snapshots.value = await unlessForbidden(uiFetch<Snapshot[]>('/snapshots'));
  };

  const load = async () => {
    const [runtime, setup] = await Promise.all([
      uiFetch<RuntimeSettings>('/runtime'),
      uiFetch<{ firstRun: boolean }>('/setup'),
      loadEnvironments(),
      loadHolders(),
      labelGroupsStore.load(),
      labelGroupsStore.loadFreeForm(),
      loadSnapshots(),
    ]);
    runtimeSettings.value = runtime;
    firstRun.value = setup.firstRun;
  };

  const saveSettings = async (settings: SettingsInput) => {
    await uiFetch('/instance', { method: 'PATCH', body: { ...settings } });
    await instanceStore.load();
  };

  const writeEnvironments = async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: Partial<EnvironmentInput> | Partial<PointerInput>) => {
    await uiFetch(path, { method, ...(body ? { body } : {}) });
    await loadEnvironments();
  };

  const createEnvironment = (input: EnvironmentInput) => writeEnvironments('/environments', 'POST', input);
  const updateEnvironment = (id: number, patch: Partial<EnvironmentInput>) => writeEnvironments(`/environments/${id}`, 'PATCH', patch);
  const deleteEnvironment = (id: number) => writeEnvironments(`/environments/${id}`, 'DELETE');
  const createPointer = (input: PointerInput) => writeEnvironments('/credential-pointers', 'POST', input);
  const updatePointer = (id: number, patch: Partial<PointerInput>) => writeEnvironments(`/credential-pointers/${id}`, 'PATCH', patch);
  const deletePointer = (id: number) => writeEnvironments(`/credential-pointers/${id}`, 'DELETE');

  const writeHolder = async <T>(path: string, body?: Record<string, unknown>) => {
    const written = await uiFetch<T>(path, { method: 'POST', ...(body ? { body } : {}) });
    await loadHolders();
    return written;
  };

  const createHolder = (input: { slug: string, displayName: string | null }) => writeHolder<HolderSecret>('/holders', input);
  const rotateHolder = (slug: string) => writeHolder<HolderSecret>(`/holders/${slug}/rotate`);
  const revokeHolder = (slug: string) => writeHolder<RosterHolder>(`/holders/${slug}/revoke`);

  const takeSnapshot = async () => {
    await uiFetch<Snapshot>('/snapshots', { method: 'POST' });
    await loadSnapshots();
  };

  const deleteSnapshot = async (name: string) => {
    await uiFetch(`/snapshots/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await loadSnapshots();
  };

  return {
    environments,
    pointers,
    holders,
    runtimeSettings,
    firstRun,
    snapshots,
    load,
    saveSettings,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    createPointer,
    updatePointer,
    deletePointer,
    createHolder,
    rotateHolder,
    revokeHolder,
    takeSnapshot,
    deleteSnapshot,
  };
});
