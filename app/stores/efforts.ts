import { defineStore } from 'pinia';
import type { Effort, Page } from '~/types/api';

const PAGE_LIMIT = 200;

export const useEffortsStore = defineStore('efforts', () => {
  const uiFetch = useUiFetch();
  const instanceStore = useInstanceStore();
  const efforts = ref<Effort[]>([]);

  const load = async () => {
    const loaded: Effort[] = [];
    let cursor: string | null = null;
    do {
      const page: Page<Effort> = await uiFetch<Page<Effort>>('/efforts', { query: { sort: 'updatedAt', order: 'desc', limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) } });
      loaded.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    efforts.value = loaded;
  };

  const create = async (draft: { title: string, name: string | null }) => {
    const { number } = await uiFetch<{ number: number }>('/issues', { method: 'POST', body: { kind: 'effort', ...draft } });
    await Promise.all([load(), instanceStore.load()]);
    return number;
  };

  return { efforts, load, create };
});
