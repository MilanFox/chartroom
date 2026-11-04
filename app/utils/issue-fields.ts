import type { Kind, LabelGroup } from '~/types/api';
import { PARENT_RULES } from '#shared/domain';

export interface ParentCandidate {
  number: number
  kind: Kind
  title: string
}

const WAYFINDER_PREFIX = 'wayfinder:';

export const labelRows = (groups: LabelGroup[], labels: string[]) => {
  const grouped = new Set(groups.flatMap(group => group.labels.map(member => member.id)));
  return {
    groups: groups.map(group => ({ group, selected: group.labels.find(member => labels.includes(member.id))?.id ?? null })),
    freeForm: labels.filter(label => !grouped.has(label)),
  };
};

export const wayfinderTypeOf = (labels: string[]) => labels.find(label => label.startsWith(WAYFINDER_PREFIX)) ?? null;

export const parentChoices = (issue: { number: number, kind: Kind }, candidates: ParentCandidate[]) => {
  const allowed = PARENT_RULES[issue.kind];
  return {
    choices: allowed.flatMap(kind => candidates.filter(candidate => candidate.kind === kind && candidate.number !== issue.number)),
    allowsNone: issue.kind === 'ticket',
  };
};

const LINKABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export const safeHref = (url: string) => (URL.canParse(url) && LINKABLE_PROTOCOLS.has(new URL(url).protocol) ? url : null);
