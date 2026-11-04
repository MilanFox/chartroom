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

  const loadSnapshots = async () => {
    snapshots.value = await uiFetch<Snapshot[]>('/snapshots').catch(orNullOn('forbidden'));
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

  const writeThen = useWriteThen(loadSnapshots);

  const takeSnapshot = () => writeThen('/snapshots', { method: 'POST' });

  const deleteSnapshot = (name: string) => writeThen(`/snapshots/${encodeURIComponent(name)}`, { method: 'DELETE' });

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
