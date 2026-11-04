import { apiErrorDetails, errorBodyOf } from '~/utils/api-error';

export interface VersionConflict {
  holder: string | null
  at: string | null
}

const isConflictOn = (failure: unknown, field: string) => {
  const error = errorBodyOf(failure)?.error;
  return error?.code === 'conflict' && error.field === field;
};

const textOf = (value: unknown) => typeof value === 'string' ? value : null;

export const versionConflictOf = (failure: unknown): VersionConflict | null => {
  if (!isConflictOn(failure, 'version')) return null;
  const { lastWrittenBy, lastWrittenAt } = apiErrorDetails(failure);
  return { holder: textOf(lastWrittenBy), at: textOf(lastWrittenAt) };
};

export const claimConflictOf = (failure: unknown) =>
  isConflictOn(failure, 'assignee') ? { holder: textOf(apiErrorDetails(failure).assignee) } : null;

export const memberClashOf = (failure: unknown) =>
  isConflictOn(failure, 'labels') ? (apiErrorDetails(failure).issues as number[] | undefined) ?? [] : null;
