export const useStrings = () => {
  const instanceStore = useInstanceStore();
  return { strings: toRef(instanceStore, 'strings'), format: formatString };
};
