import type { InstanceNames } from '~/types/api';
import type { AdminSectionId } from './paths';
import type { StringNames } from './strings';

export type FirstRunStep = 'project' | 'effort' | 'environments' | 'holder';

interface FirstRunState {
  names: InstanceNames | null
  defaults: StringNames
  environments: number
  holders: number
  settingsSaved?: boolean
}

export const firstRunChecklist = ({ names, defaults, environments, holders, settingsSaved = false }: FirstRunState) => {
  const steps: [FirstRunStep, AdminSectionId, boolean][] = [
    ['project', 'settings', settingsSaved || (names !== null && names.projectName !== defaults.project)],
    ['effort', 'settings', settingsSaved || (names !== null && names.effortName.singular !== defaults.effort)],
    ['environments', 'environments', environments > 0],
    ['holder', 'holders', holders > 0],
  ];
  return steps.map(([id, section, done]) => ({ id, section, done }));
};
