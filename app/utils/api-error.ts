import type { ApiErrorBody } from '~/types/api';

export const errorBodyOf = (error: unknown) => (error as { data?: Partial<ApiErrorBody> } | null)?.data;

export const apiErrorCode = (error: unknown) => errorBodyOf(error)?.error?.code ?? null;

export const apiErrorField = (error: unknown) => errorBodyOf(error)?.error?.field ?? null;

export const apiErrorDetails = (error: unknown) => errorBodyOf(error)?.error?.details ?? {};

export const apiErrorMessage = (error: unknown) => errorBodyOf(error)?.error?.message ?? '';

export const orNullOn = (code: string) => (error: unknown) => {
  if (apiErrorCode(error) !== code) throw error;
  return null;
};

export const fieldErrorOf = (failure: unknown, fields: readonly string[]) => {
  const field = apiErrorField(failure);
  if (!field || !fields.includes(field)) return null;
  return { field, message: apiErrorMessage(failure) };
};

export const slugErrorOf = (failure: unknown, messages: { taken: string, shape: string }) => (apiErrorCode(failure) === 'conflict' ? messages.taken : messages.shape);
