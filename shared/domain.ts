export type Kind = 'effort' | 'map' | 'spec' | 'ticket';
export type IssueState = 'open' | 'closed';
export type IssueStatus = 'open' | 'claimed' | 'blocked' | 'closed';
export type IssueView = 'frontier' | 'mine' | 'needs-triage' | 'blocked' | 'closed-recent';
export type LinkRole = 'resource' | 'artifact';
export type LinkType = 'branch' | 'file' | 'preview' | 'doc' | 'external';

export const LOGGED_FIELDS = ['title', 'body', 'parent', 'name', 'testInstructions'] as const;
export const EFFORT_ONLY_FIELDS = ['name', 'testInstructions'] as const;

export type ChangeField = typeof LOGGED_FIELDS[number] | 'state' | 'assignee' | 'comment' | 'label' | 'blocker' | 'link';

export const KINDS: Kind[] = ['effort', 'map', 'spec', 'ticket'];
export const ISSUE_STATES: IssueState[] = ['open', 'closed'];
export const STATUSES: IssueStatus[] = ['open', 'claimed', 'blocked', 'closed'];
export const ISSUE_VIEWS: IssueView[] = ['frontier', 'mine', 'needs-triage', 'blocked', 'closed-recent'];
export const LINK_ROLES: LinkRole[] = ['resource', 'artifact'];
export const LINK_TYPES: LinkType[] = ['branch', 'file', 'preview', 'doc', 'external'];
export const UNASSIGNED = 'none';

export const PARENT_RULES: Record<Kind, Kind[]> = {
  effort: [],
  map: ['effort'],
  spec: ['effort'],
  ticket: ['map', 'spec', 'effort'],
};
