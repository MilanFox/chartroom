import type { ExcerptedRow, IssueStatus } from '~/types/api';

export interface SpecCardProps {
  spec: ExcerptedRow
  counts: Record<IssueStatus, number>
  artifacts: number
}
