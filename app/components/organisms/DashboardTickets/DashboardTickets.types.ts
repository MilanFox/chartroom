import type { EffortDocument, IssueRow } from '~/types/api';

export interface DashboardTicketsProps {
  effort: EffortDocument
  rows: IssueRow[]
}
