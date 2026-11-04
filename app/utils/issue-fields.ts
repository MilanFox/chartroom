import type { IssueKind, LabelGroup } from '~/types/api';

export interface ParentCandidate {
  number: number
  kind: IssueKind
  title: string
}

const WAYFINDER_PREFIX = 'wayfinder:';

const PARENT_KINDS: Record<IssueKind, IssueKind[]> = {
  effort: [],
  map: ['effort'],
  spec: ['effort'],
  ticket: ['map', 'spec', 'effort'],
};

export const labelRows = (groups: LabelGroup[], labels: string[]) => {
  const grouped = new Set(groups.flatMap(group => group.labels.map(member => member.id)));
  return {
    groups: groups.map(group => ({ group, selected: group.labels.find(member => labels.includes(member.id))?.id ?? null })),
    freeForm: labels.filter(label => !grouped.has(label)),
  };
};

export const wayfinderTypeOf = (labels: string[]) => labels.find(label => label.startsWith(WAYFINDER_PREFIX)) ?? null;

export const parentChoices = (issue: { number: number, kind: IssueKind }, candidates: ParentCandidate[]) => {
  const allowed = PARENT_KINDS[issue.kind];
  return {
    choices: allowed.flatMap(kind => candidates.filter(candidate => candidate.kind === kind && candidate.number !== issue.number)),
    allowsNone: issue.kind === 'ticket',
  };
};

const LINKABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export const safeHref = (url: string) => (URL.canParse(url) && LINKABLE_PROTOCOLS.has(new URL(url).protocol) ? url : null);
