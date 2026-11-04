import type { IssueRow } from '~/types/api';

export interface GraphNodeProps {
  row: IssueRow
  x: number
  y: number
  width: number
  height: number
  clipId: string
  glyph: string | null
  mark: string | null
  blockers: number[]
}
