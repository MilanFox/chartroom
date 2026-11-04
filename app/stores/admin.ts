import { defineStore } from 'pinia';
import type { RuntimeSettings, SettingsInput, Snapshot } from '~/types/api';

export const useAdminStore = defineStore('admin', () => {
  const uiFetch = useUiFetch();
  const instanceStore = useInstanceStore();
  const labelGroupsStore = useLabelGroupsStore();
  const environmentsStore = useEnvironmentsStore();
  const holdersStore = useHoldersStore();
  const runtimeSettings = ref<RuntimeSettings | null>(null);
  const firstRun = ref<boolean | null>(null);
  const snapshots = ref<Snapshot[] | null>(null);

  const unlessForbidden = <T>(read: Promise<T>) => read.catch((error) => {
    if (apiErrorCode(error) !== 'forbidden') throw error;
    return null;
  });

  const loadSnapshots = async () => {
    snapshots.value = await unlessForbidden(uiFetch<Snapshot[]>('/snapshots'));
  };

  const load = async () => {
    const [runtime, setup] = await Promise.all([
      uiFetch<RuntimeSettings>('/runtime'),
      uiFetch<{ firstRun: boolean }>('/setup'),
      environmentsStore.load(),
      holdersStore.load(),
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

  const takeSnapshot = async () => {
    await uiFetch<Snapshot>('/snapshots', { method: 'POST' });
    await loadSnapshots();
  };

  const deleteSnapshot = async (name: string) => {
    await uiFetch(`/snapshots/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await loadSnapshots();
  };

  return {
    runtimeSettings,
    firstRun,
    snapshots,
    load,
    saveSettings,
    takeSnapshot,
    deleteSnapshot,
  };
});
