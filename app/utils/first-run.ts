import type { AdminSectionId } from './paths';

export type FirstRunStep = 'holder';

interface FirstRunState {
  holders: number
}

export const firstRunChecklist = ({ holders }: FirstRunState) => {
  const steps: [FirstRunStep, AdminSectionId, boolean][] = [
    ['holder', 'holders', holders > 0],
  ];
  return steps.map(([id, section, done]) => ({ id, section, done }));
};
