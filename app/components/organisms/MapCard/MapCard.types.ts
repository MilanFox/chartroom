import type { ExcerptedRow, IssueRow } from '~/types/api';

export interface MapCardProps {
  map: ExcerptedRow
  frontier: number
  rows: IssueRow[]
}
