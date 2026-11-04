import { defineStore } from 'pinia';
import type { Effort } from '~/types/api';

export const useEffortsStore = defineStore('efforts', () => {
  const uiFetch = useUiFetch();
  const allPages = useAllPages();
  const instanceStore = useInstanceStore();
  const efforts = ref<Effort[]>([]);

  const load = async () => {
    efforts.value = await allPages<Effort>('/efforts', { sort: 'updatedAt', order: 'desc' });
  };

  const create = async (draft: { title: string, name: string | null }) => {
    const { number } = await uiFetch<{ number: number }>('/issues', { method: 'POST', body: { kind: 'effort', ...draft } });
    await Promise.all([load(), instanceStore.load()]);
    return number;
  };

  return { efforts, load, create };
});
