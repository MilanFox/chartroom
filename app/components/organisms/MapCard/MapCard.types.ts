import type { IssueRow } from '~/types/api';

export interface MapCardProps {
  map: IssueRow
  frontier: number
  body: string
  rows: IssueRow[]
}
