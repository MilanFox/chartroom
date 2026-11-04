import { defineStore } from 'pinia';
import type { CredentialPointer, Environment, EnvironmentInput, HolderSecret, LabelGroupInput, LabelGroupMemberInput, PointerInput, RosterHolder, RuntimeSettings, SettingsInput, Snapshot } from '~/types/api';

const moved = (ids: string[], id: string, offset: number) => {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const reordered = ids.filter(other => other !== id);
  reordered.splice(to, 0, id);
  return reordered;
};

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

  const loadLabels = () => Promise.all([labelGroupsStore.load(), labelGroupsStore.loadFreeForm()]);

  const loadSnapshots = async () => {
    snapshots.value = await unlessForbidden(uiFetch<Snapshot[]>('/snapshots'));
  };

  const load = async () => {
    const [runtime, setup] = await Promise.all([
      uiFetch<RuntimeSettings>('/runtime'),
      uiFetch<{ firstRun: boolean }>('/setup'),
      loadEnvironments(),
      loadHolders(),
      loadLabels(),
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

  const writeLabels = async (path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: Record<string, unknown>) => {
    await uiFetch(path, { method, ...(body ? { body } : {}) });
    await loadLabels();
  };

  const groupPath = (groupId: string) => `/label-groups/${encodeURIComponent(groupId)}`;
  const memberPath = (groupId: string, memberId: string) => `${groupPath(groupId)}/labels/${encodeURIComponent(memberId)}`;

  const createLabelGroup = (input: LabelGroupInput) => writeLabels('/label-groups', 'POST', { ...input });
  const renameLabelGroup = (groupId: string, displayName: string) => writeLabels(groupPath(groupId), 'PATCH', { displayName });
  const deleteLabelGroup = (groupId: string) => writeLabels(groupPath(groupId), 'DELETE');
  const addGroupMember = (groupId: string, member: LabelGroupMemberInput) => writeLabels(`${groupPath(groupId)}/labels`, 'POST', { ...member });
  const renameGroupMember = (groupId: string, memberId: string, displayLabel: string) => writeLabels(memberPath(groupId, memberId), 'PATCH', { displayLabel });
  const removeGroupMember = (groupId: string, memberId: string) => writeLabels(memberPath(groupId, memberId), 'DELETE');

  const moveLabelGroup = async (groupId: string, offset: number) => {
    const groups = moved(labelGroupsStore.labelGroups.filter(group => !group.seeded).map(group => group.id), groupId, offset);
    if (groups) await writeLabels('/label-groups/order', 'PUT', { groups });
  };

  const moveGroupMember = async (groupId: string, memberId: string, offset: number) => {
    const group = labelGroupsStore.labelGroups.find(candidate => candidate.id === groupId);
    const labels = group && moved(group.labels.map(member => member.id), memberId, offset);
    if (labels) await writeLabels(`${groupPath(groupId)}/labels/order`, 'PUT', { labels });
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
    createLabelGroup,
    renameLabelGroup,
    deleteLabelGroup,
    addGroupMember,
    renameGroupMember,
    removeGroupMember,
    moveLabelGroup,
    moveGroupMember,
    takeSnapshot,
    deleteSnapshot,
  };
});
