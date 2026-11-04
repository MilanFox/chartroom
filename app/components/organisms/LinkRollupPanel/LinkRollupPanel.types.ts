import type { EffortDocument, IssueRow } from '~/types/api';

export interface LinkRollupPanelProps {
  effort: EffortDocument
  rows: IssueRow[]
}
