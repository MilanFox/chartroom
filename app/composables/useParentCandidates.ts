export const useParentCandidates = () => {
  const issuesStore = useIssuesStore();
  return useAsyncData('parent-candidates', async () => {
    await issuesStore.loadParentCandidates();
    return true;
  });
};
