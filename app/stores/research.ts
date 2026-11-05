import { defineStore } from 'pinia';
import type { ResearchNote, ResearchNoteSummary } from '~/types/api';

export const researchNoteKey = (issue: number, slug: string) => `${issue}/${slug}`;

export const useResearchStore = defineStore('research', () => {
  const uiFetch = useUiFetch();
  const lists = ref<Record<number, ResearchNoteSummary[]>>({});
  const notes = ref<Record<string, ResearchNote>>({});

  const loadList = async (issue: number) => {
    lists.value[issue] = (await uiFetch<{ items: ResearchNoteSummary[] }>(`/issues/${issue}/research`)).items;
  };

  const load = async (issue: number, slug: string) => {
    const note = await uiFetch<ResearchNote>(`/issues/${issue}/research/${encodeURIComponent(slug)}`);
    notes.value[researchNoteKey(issue, slug)] = note;
    return note;
  };

  return { lists, notes, loadList, load };
});
