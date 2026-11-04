type ListChoice = 'open' | 'closed';

export const useMapListDisclosure = (map: number, mapState: () => 'open' | 'closed') => {
  const choice = useLocalStorage<ListChoice | null>(`chartroom:map-list:${map}`, null, { initOnMounted: true });
  const expanded = computed(() => (choice.value ?? mapState()) === 'open');
  const toggle = () => choice.value = expanded.value ? 'closed' : 'open';
  return { expanded, toggle };
};
