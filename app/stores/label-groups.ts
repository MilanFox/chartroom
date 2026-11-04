import { defineStore } from 'pinia';
import type { LabelGroup } from '~/types/api';

export const useLabelGroupsStore = defineStore('label-groups', () => {
  const uiFetch = useUiFetch();
  const labelGroups = ref<LabelGroup[]>([]);

  const load = async () => {
    labelGroups.value = await uiFetch<LabelGroup[]>('/labels');
  };

  return { labelGroups, load };
});
