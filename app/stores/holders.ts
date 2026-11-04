import { defineStore } from 'pinia';
import type { HolderSecret, RosterHolder } from '~/types/api';

export const useHoldersStore = defineStore('holders', () => {
  const uiFetch = useUiFetch();
  const holders = ref<RosterHolder[] | null>(null);
  const assignable = computed(() => holders.value ?? []);

  const load = async () => {
    try {
      holders.value = await uiFetch<RosterHolder[]>('/holders');
    }
    catch (error) {
      if (apiErrorCode(error) !== 'forbidden') throw error;
      holders.value = null;
    }
  };

  const writeHolder = async <T>(path: string, body?: Record<string, unknown>) => {
    const written = await uiFetch<T>(path, { method: 'POST', ...(body ? { body } : {}) });
    await load();
    return written;
  };

  const createHolder = (input: { slug: string, displayName: string | null }) => writeHolder<HolderSecret>('/holders', input);
  const rotateHolder = (slug: string) => writeHolder<HolderSecret>(`/holders/${slug}/rotate`);
  const revokeHolder = (slug: string) => writeHolder<RosterHolder>(`/holders/${slug}/revoke`);

  return { holders, assignable, load, createHolder, rotateHolder, revokeHolder };
});
