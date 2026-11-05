import { defineStore } from 'pinia';
import type { ClosedEffort, EffortDeletion, RuntimeSettings, SettingsInput, Snapshot } from '~/types/api';

export const useAdminStore = defineStore('admin', () => {
  const uiFetch = useUiFetch();
  const instanceStore = useInstanceStore();
  const labelGroupsStore = useLabelGroupsStore();
  const environmentsStore = useEnvironmentsStore();
  const holdersStore = useHoldersStore();
  const effortsStore = useEffortsStore();
  const runtimeSettings = ref<RuntimeSettings | null>(null);
  const firstRun = ref<boolean | null>(null);
  const snapshots = ref<Snapshot[] | null>(null);
  const closedEfforts = ref<ClosedEffort[] | null>(null);

  const loadSnapshots = async () => {
    snapshots.value = await uiFetch<Snapshot[]>('/snapshots').catch(orNullOn('forbidden'));
  };

  const loadClosedEfforts = async () => {
    closedEfforts.value = await uiFetch<ClosedEffort[]>('/admin/closed-efforts').catch(orNullOn('forbidden'));
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
      loadClosedEfforts(),
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

  const deleteEffort = async (number: number) => {
    const deletion = await uiFetch<EffortDeletion>(`/efforts/${number}`, { method: 'DELETE' });
    await Promise.all([loadClosedEfforts(), loadSnapshots(), effortsStore.load(), instanceStore.load()]);
    return deletion;
  };

  return {
    runtimeSettings,
    firstRun,
    snapshots,
    closedEfforts,
    load,
    saveSettings,
    takeSnapshot,
    deleteSnapshot,
    deleteEffort,
  };
});
