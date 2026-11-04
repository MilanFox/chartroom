import { defineStore } from 'pinia';
import type { Instance } from '~/types/api';

export const useInstanceStore = defineStore('instance', () => {
  const uiFetch = useUiFetch();
  const instance = ref<Instance | null>(null);

  const load = async () => {
    instance.value = await uiFetch<Instance>('/instance');
  };

  return { instance, load };
});
