export interface ApiErrorBody {
  error: { code: string, message: string, field?: string }
}

export interface Me {
  slug: string | null
  displayName: string | null
  viewer: boolean
  admin: { until: string } | null
}

export interface InstanceNames {
  projectName: string
  effortName: { singular: string, plural: string }
}

export interface Instance extends InstanceNames {
  triageLabels: Record<string, string>
  version: string
  updateAvailable: string | null
  openIssues: number
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export type IssueKind = 'effort' | 'map' | 'spec' | 'ticket';
export type IssueStatus = 'open' | 'claimed' | 'blocked' | 'closed';

export interface StatusRollup {
  map: { state: 'open' | 'closed', frontier: number } | null
  specs: { number: number, tickets: Record<string, number> }[]
  triage: Record<string, number>
  open: number
}

export interface Effort {
  number: number
  name: string | null
  title: string
  state: 'open' | 'closed'
  status: IssueStatus
  labels: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  statusRollup: StatusRollup
}

export type Origin = 'ui' | 'api';

export interface IssueRow {
  number: number
  kind: IssueKind
  title: string
  state: 'open' | 'closed'
  status: IssueStatus
  assignee: string | null
  parent: number | null
  effort: number | null
  labels: string[]
  createdAt: string
  updatedAt: string
  url: string
}

export interface EffortCount {
  effort: number | null
  count: number
}

export interface IssuePage extends Page<IssueRow> {
  effortCounts: EffortCount[]
}

export interface IssueComment {
  id: number
  issue: number
  author: string
  body: string
  origin: Origin
  resolution: boolean
  createdAt: string
  updatedAt: string
  url: string
}

export type LinkRole = 'resource' | 'artifact';
export type LinkType = 'branch' | 'file' | 'preview' | 'doc' | 'external';

export interface IssueLink {
  id: number
  issue: number
  role: LinkRole
  type: LinkType
  url: string
  title: string
  addedBy: string
  origin: Origin
  createdAt: string
}

export interface IssueDocument extends IssueRow {
  body: string
  createdBy: string
  origin: Origin
  closedAt: string | null
  version: number
  blockedBy: { number: number, title: string, open: boolean }[]
  blocks: { number: number, title: string }[]
  children: number[]
  links: IssueLink[]
  comments: IssueComment[]
  resolution: IssueComment | null
}

export interface LabelGroup {
  id: string
  displayName: string
  seeded: boolean
  exclusive: true
  labels: { id: string, displayLabel: string }[]
}

export interface Holder {
  slug: string
  displayName: string | null
  revoked: boolean
}

export interface FreeFormLabel {
  label: string
  count: number
}
