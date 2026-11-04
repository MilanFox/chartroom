import { defineStore } from 'pinia';
import type { FreeFormLabel, LabelGroup } from '~/types/api';

export const useLabelGroupsStore = defineStore('label-groups', () => {
  const uiFetch = useUiFetch();
  const labelGroups = ref<LabelGroup[]>([]);
  const freeFormLabels = ref<FreeFormLabel[]>([]);

  const load = async () => {
    labelGroups.value = await uiFetch<LabelGroup[]>('/labels');
  };

  const loadFreeForm = async () => {
    freeFormLabels.value = await uiFetch<FreeFormLabel[]>('/labels/free-form');
  };

  return { labelGroups, freeFormLabels, load, loadFreeForm };
});
