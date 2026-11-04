export const useLabelGroupsLoaded = () => {
  const labelGroupsStore = useLabelGroupsStore();
  return useAsyncData('label-groups', async () => {
    await labelGroupsStore.load();
    return true;
  });
};
