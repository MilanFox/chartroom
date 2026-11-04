import type { LinkDraft } from '~/stores/issues';

export interface LinkFormProps {
  heading: string
  submitLabel: string
  initial?: LinkDraft
  withUrl?: boolean
  cancellable?: boolean
  error?: { field: 'url' | 'title' | null, message: string } | null
}
