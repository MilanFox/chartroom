import catalog from '~/strings/en.json';

export const useStrings = () => {
  const instanceStore = useInstanceStore();
  const strings = computed(() => resolveStrings(catalog, instanceStore.instance));
  return { strings, format: formatString };
};
