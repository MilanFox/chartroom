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
