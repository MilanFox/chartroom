import type { EffortDocument } from '~/types/api';

export interface EffortTagsProps {
  effort: Pick<EffortDocument, 'number' | 'labels'>
}
