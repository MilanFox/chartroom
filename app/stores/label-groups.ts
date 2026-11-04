import { defineStore } from 'pinia';
import type { FreeFormLabel, LabelGroup } from '~/types/api';

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

  return { labelGroups, freeFormLabels, displayLabelOf, load, loadFreeForm };
});
