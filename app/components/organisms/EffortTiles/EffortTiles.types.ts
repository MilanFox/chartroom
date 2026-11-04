import type { EffortDocument, IssueRow } from '~/types/api';

export interface EffortTilesProps {
  effort: EffortDocument
  rows: IssueRow[]
}
