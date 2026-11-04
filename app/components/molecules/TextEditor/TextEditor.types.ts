import type { VersionConflict } from '~/utils/conflict';

export interface TextEditorProps {
  label: string
  multiline?: boolean
  saving?: boolean
  failed?: boolean
  failedMessage?: string
  conflict?: VersionConflict | null
}
