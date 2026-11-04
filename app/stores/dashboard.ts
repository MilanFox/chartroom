import { defineStore } from 'pinia';
import type { EffortDocument, IssueDocument, IssueRow } from '~/types/api';

export const useDashboardStore = defineStore('dashboard', () => {
  const uiFetch = useUiFetch();
  const allPages = useAllPages();
  const effort = ref<EffortDocument | null>(null);
  const rows = ref<IssueRow[]>([]);
  const parentBodies = ref<Record<number, string>>({});
  let latestLoad = 0;

  const subtreeOf = async (number: number) => {
    const subtree = await allPages<IssueRow>('/issues', { effort: number, sort: 'number', order: 'asc' });
    return subtree.filter(issue => issue.number !== number);
  };

  const parentBodiesOf = async (document: EffortDocument) => {
    const parents = [...(document.map ? [document.map] : []), ...document.specs];
    const documents = await Promise.all(parents.map(({ number }) => uiFetch<IssueDocument>(`/issues/${number}`)));
    return Object.fromEntries(documents.map(({ number, body }) => [number, body]));
  };

  const load = async (number: number) => {
    const request = ++latestLoad;
    const [document, subtree] = await Promise.all([uiFetch<EffortDocument>(`/efforts/${number}`), subtreeOf(number)]);
    const bodies = await parentBodiesOf(document);
    if (request !== latestLoad) return;
    effort.value = document;
    rows.value = subtree;
    parentBodies.value = bodies;
  };

  const refresh = async () => {
    if (effort.value) await load(effort.value.number);
  };

  const openChildren = computed(() => rows.value.filter(row => row.state === 'open').length);

  const artifactsMarkdown = async () => (effort.value ? uiFetch<string>(`/efforts/${effort.value.number}/artifacts.md`) : '');

  return { effort, rows, parentBodies, openChildren, load, refresh, artifactsMarkdown };
});
