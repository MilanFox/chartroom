import type { ApiErrorBody } from '~/types/api';

export interface VersionConflict {
  holder: string | null
  at: string | null
}

const conflictMessage = (failure: unknown, field: string) => {
  const error = (failure as { data?: Partial<ApiErrorBody> } | null)?.data?.error;
  return error?.code === 'conflict' && error.field === field ? error.message : null;
};

export const versionConflictOf = (failure: unknown): VersionConflict | null => {
  const message = conflictMessage(failure, 'version');
  if (message === null) return null;
  const match = message.match(/last written by (\S+) at (\S+)$/);
  return { holder: match?.[1] ?? null, at: match?.[2] ?? null };
};

export const claimConflictOf = (failure: unknown) => {
  const message = conflictMessage(failure, 'assignee');
  return message === null ? null : { holder: message.match(/held by (\S+)$/)?.[1] ?? null };
};
