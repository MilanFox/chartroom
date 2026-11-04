import type { IssueRow, IssueStatus } from '~/types/api';

export interface SpecCardProps {
  spec: IssueRow
  counts: Record<IssueStatus, number>
  body: string
  artifacts: number
}
