import type { ChangeField, IssueState, IssueStatus, Kind, LinkRole, LinkType } from './domain';

export interface ApiErrorBody {
  error: { code: string, message: string, field?: string, details?: Record<string, unknown> }
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

export interface UpdateNotice {
  version: string
  url: string
}

export interface Instance extends InstanceNames {
  triageLabels: Record<string, string>
  version: string
  updateAvailable: UpdateNotice | null
  openIssues: number
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface StatusRollup {
  map: { state: IssueState, frontier: number } | null
  specs: { number: number, tickets: Record<IssueStatus, number> }[]
  triage: Record<string, number>
  open: number
}

export interface Effort {
  number: number
  name: string | null
  title: string
  state: IssueState
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
  kind: Kind
  title: string
  state: IssueState
  status: IssueStatus
  assignee: string | null
  parent: number | null
  effort: number | null
  labels: string[]
  blockedBy: { number: number, open: boolean }[]
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
  name?: string | null
  testInstructions?: string | null
}

export interface RolledUpLink {
  url: string
  title: string
  type: LinkType
  sources: number[]
}

export type LinkRollup = Record<LinkRole, RolledUpLink[]>;

export interface EffortDocument extends IssueDocument {
  name: string | null
  testInstructions: string | null
  statusRollup: StatusRollup
  linkRollup: LinkRollup
  map: IssueRow | null
  specs: IssueRow[]
}

export interface CredentialPointer {
  id: number
  label: string
  accountName: string
  whereToFind: string
  environment: number | null
}

export interface Environment {
  id: number
  name: string
  url: string
  notes: string | null
  credentialPointers?: CredentialPointer[]
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

export interface RosterHolder extends Holder {
  createdAt?: string
  lastUsedAt?: string | null
  revokedAt?: string | null
}

export interface HolderSecret extends RosterHolder {
  secret: string
}

export interface RuntimeSettings {
  baseUrl: string | null
  trustProxy: boolean
  port: number
  updateCheck: boolean
  projectName: string | null
}

export interface SettingsInput {
  projectName: string
  effortName: { singular: string, plural: string | null }
  triageLabels: Record<string, string>
}

export type EnvironmentInput = Pick<Environment, 'name' | 'url' | 'notes'>;

export type PointerInput = Omit<CredentialPointer, 'id'>;

export interface FreeFormLabel {
  label: string
  count: number
}

export interface LabelGroupMemberInput {
  id: string
  displayLabel: string | null
}

export interface LabelGroupInput {
  id: string
  displayName: string | null
  labels: LabelGroupMemberInput[]
}

export interface Snapshot {
  name: string
  trigger: 'pre-migrate' | 'manual'
  takenAt: string
  size: number
}

export interface IssueChange {
  id: number
  issue: number
  actor: string
  origin: Origin
  at: string
  field: ChangeField
  before: string | null
  after: string | null
}
