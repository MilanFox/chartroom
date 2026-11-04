import type { UnwrapNestedRefs } from 'vue';

export interface VersionedTextEditorProps {
  editor: UnwrapNestedRefs<ReturnType<typeof useVersionedEditor>>
  label: string
  multiline?: boolean
  failedMessage?: string
}
