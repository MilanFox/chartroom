import type { IssueDocument } from '~/types/api';

export const useIssueChildren = async (issue: () => IssueDocument) => {
  const issuesStore = useIssuesStore();
  const { error } = await useAsyncData(() => `issue-children-${issue().number}`, async () => {
    await issuesStore.loadChildren(issue().number);
    return true;
  });
  return { rows: computed(() => issuesStore.children[issue().number] ?? null), failed: computed(() => Boolean(error.value)) };
};
