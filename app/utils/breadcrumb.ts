import type { Kind } from '~/types/api';
import { effortPath, HOME_PATH, issuePath, ISSUES_PATH } from './paths';
import type { EffortRef } from './paths';
import { formatString } from './strings';

export interface Crumb {
  label: string
  to?: string
}

export interface CrumbLabels {
  issues: string
  efforts: string
  map: string
  spec: string
  issue: string
  issueTitled: string
}

interface IssueCrumbTarget {
  page: 'issue'
  issue: { number: number, kind: Kind }
  effort: EffortRef | null
  parent: { number: number, kind: Kind, title: string } | null
}

interface ResearchCrumbTarget {
  page: 'research'
  issue: { number: number, kind: Kind, title: string }
  effort: EffortRef | null
  note: { title: string }
}

export type CrumbTarget = { page: 'efforts' } | { page: 'dashboard', effort: EffortRef } | IssueCrumbTarget | ResearchCrumbTarget;

const issueCrumbs = ({ issue, effort, parent }: IssueCrumbTarget, labels: CrumbLabels): Crumb[] => {
  const crumbs: Crumb[] = [{ label: labels.issues, to: ISSUES_PATH }];
  if (effort) crumbs.push({ label: effort.title, to: effortPath(effort) });
  if (parent && (parent.kind === 'map' || parent.kind === 'spec')) {
    crumbs.push({ label: formatString(labels[parent.kind], { title: parent.title }), to: issuePath(parent.number) });
  }
  crumbs.push({ label: formatString(labels.issue, { number: issue.number }) });
  return crumbs;
};

const researchCrumbs = ({ issue, effort, note }: ResearchCrumbTarget, labels: CrumbLabels): Crumb[] => {
  const crumbs: Crumb[] = [{ label: labels.issues, to: ISSUES_PATH }];
  const onEffort = issue.kind === 'effort';
  if (effort && !onEffort) crumbs.push({ label: effort.title, to: effortPath(effort) });
  crumbs.push({ label: formatString(labels.issueTitled, { number: issue.number, title: issue.title }), to: onEffort ? effortPath(issue) : issuePath(issue.number) });
  crumbs.push({ label: note.title });
  return crumbs;
};

export const crumbsFor = (target: CrumbTarget, labels: CrumbLabels): Crumb[] => {
  if (target.page === 'issue') return issueCrumbs(target, labels);
  if (target.page === 'research') return researchCrumbs(target, labels);
  if (target.page === 'efforts') return [{ label: labels.efforts }];
  return [
    { label: labels.efforts, to: HOME_PATH },
    { label: target.effort.title },
  ];
};
