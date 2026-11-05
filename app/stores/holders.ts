import { defineStore } from 'pinia';
import type { HolderSecret, Page, RosterHolder } from '~/types/api';

export const useHoldersStore = defineStore('holders', () => {
  const uiFetch = useUiFetch();
  const holders = ref<RosterHolder[] | null>(null);
  const assignable = computed(() => holders.value ?? []);

  const load = async () => {
    holders.value = (await uiFetch<Page<RosterHolder>>('/holders').catch(orNullOn('forbidden')))?.items ?? null;
  };

  const writeThen = useWriteThen(load);

  const writeHolder = <T>(path: string, body?: Record<string, unknown>) => writeThen<T>(path, { method: 'POST', body });

  const createHolder = (input: { slug: string, displayName: string | null }) => writeHolder<HolderSecret>('/holders', input);
  const rotateHolder = (slug: string) => writeHolder<HolderSecret>(`/holders/${slug}/rotate`);
  const revokeHolder = (slug: string) => writeHolder<RosterHolder>(`/holders/${slug}/revoke`);

  return { holders, assignable, load, createHolder, rotateHolder, revokeHolder };
});
