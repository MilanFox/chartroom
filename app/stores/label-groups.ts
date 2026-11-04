import { defineStore } from 'pinia';
import type { FreeFormLabel, LabelGroup, LabelGroupInput, LabelGroupMemberInput } from '~/types/api';

const moved = (ids: string[], id: string, offset: number) => {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const reordered = ids.filter(other => other !== id);
  reordered.splice(to, 0, id);
  return reordered;
};

export const useLabelGroupsStore = defineStore('label-groups', () => {
  const uiFetch = useUiFetch();
  const labelGroups = ref<LabelGroup[]>([]);
  const freeFormLabels = ref<FreeFormLabel[]>([]);
  const displayLabels = computed(() => new Map(labelGroups.value.flatMap(group => group.labels.map(member => [member.id, member.displayLabel]))));

  const displayLabelOf = (label: string) => displayLabels.value.get(label) ?? label;

  const load = async () => {
    labelGroups.value = await uiFetch<LabelGroup[]>('/labels');
  };

  const loadFreeForm = async () => {
    freeFormLabels.value = await uiFetch<FreeFormLabel[]>('/labels/free-form');
  };

  const reload = () => Promise.all([load(), loadFreeForm()]);

  const writeThen = useWriteThen(reload);

  const writeLabels = (path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: Record<string, unknown>) => writeThen(path, { method, body });

  const groupPath = (groupId: string) => `/label-groups/${encodeURIComponent(groupId)}`;
  const memberPath = (groupId: string, memberId: string) => `${groupPath(groupId)}/labels/${encodeURIComponent(memberId)}`;

  const createLabelGroup = (input: LabelGroupInput) => writeLabels('/label-groups', 'POST', { ...input });
  const renameLabelGroup = (groupId: string, displayName: string) => writeLabels(groupPath(groupId), 'PATCH', { displayName });
  const deleteLabelGroup = (groupId: string) => writeLabels(groupPath(groupId), 'DELETE');
  const addGroupMember = (groupId: string, member: LabelGroupMemberInput) => writeLabels(`${groupPath(groupId)}/labels`, 'POST', { ...member });
  const renameGroupMember = (groupId: string, memberId: string, displayLabel: string) => writeLabels(memberPath(groupId, memberId), 'PATCH', { displayLabel });
  const removeGroupMember = (groupId: string, memberId: string) => writeLabels(memberPath(groupId, memberId), 'DELETE');

  const moveLabelGroup = async (groupId: string, offset: number) => {
    const groups = moved(labelGroups.value.filter(group => !group.seeded).map(group => group.id), groupId, offset);
    if (groups) await writeLabels('/label-groups/order', 'PUT', { groups });
  };

  const moveGroupMember = async (groupId: string, memberId: string, offset: number) => {
    const group = labelGroups.value.find(candidate => candidate.id === groupId);
    const labels = group && moved(group.labels.map(member => member.id), memberId, offset);
    if (labels) await writeLabels(`${groupPath(groupId)}/labels/order`, 'PUT', { labels });
  };

  return {
    labelGroups,
    freeFormLabels,
    displayLabelOf,
    load,
    loadFreeForm,
    createLabelGroup,
    renameLabelGroup,
    deleteLabelGroup,
    addGroupMember,
    renameGroupMember,
    removeGroupMember,
    moveLabelGroup,
    moveGroupMember,
  };
});
