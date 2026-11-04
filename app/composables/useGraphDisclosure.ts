import type { IssueRow } from '~/types/api';

type SectionChoice = 'open' | 'closed';

export const useGraphDisclosure = (parent: () => Pick<IssueRow, 'number' | 'kind' | 'state'>) => {
  const choice = useLocalStorage<SectionChoice | null>(() => `chartroom:graph:${parent().number}`, null, { initOnMounted: true });
  const hideClosed = useLocalStorage('chartroom:graph-hide-closed', false, { initOnMounted: true });
  const expanded = computed(() => (choice.value ?? (parent().kind === 'map' && parent().state === 'open' ? 'open' : 'closed')) === 'open');
  const toggle = () => choice.value = expanded.value ? 'closed' : 'open';
  return { expanded, toggle, hideClosed };
};
