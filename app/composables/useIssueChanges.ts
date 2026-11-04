import type { IssueDocument } from '~/types/api';

export const useIssueChanges = (issue: () => IssueDocument) => {
  const issuesStore = useIssuesStore();
  watch(() => issue().updatedAt, () => issuesStore.loadChanges(issue().number), { immediate: true });
  return computed(() => issuesStore.changes[issue().number] ?? []);
};
