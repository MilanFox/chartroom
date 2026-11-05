import type { IssueDocument } from '~/types/api';

export interface DependencyGraphProps {
  issue: Pick<IssueDocument, 'number' | 'kind' | 'state'>
  bare?: boolean
}
