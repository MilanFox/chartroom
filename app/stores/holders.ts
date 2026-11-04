import { defineStore } from 'pinia';
import type { Holder } from '~/types/api';

export const useHoldersStore = defineStore('holders', () => {
  const uiFetch = useUiFetch();
  const holders = ref<Holder[]>([]);

  const load = async () => {
    try {
      holders.value = await uiFetch<Holder[]>('/holders');
    }
    catch (error) {
      if (apiErrorCode(error) !== 'forbidden') throw error;
      holders.value = [];
    }
  };

  return { holders, load };
});
