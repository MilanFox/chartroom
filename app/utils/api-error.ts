import type { ApiErrorBody } from '~/types/api';

export const errorBodyOf = (error: unknown) => (error as { data?: Partial<ApiErrorBody> } | null)?.data;

export const apiErrorCode = (error: unknown) => errorBodyOf(error)?.error?.code ?? null;

export const apiErrorField = (error: unknown) => errorBodyOf(error)?.error?.field ?? null;

export const apiErrorMessage = (error: unknown) => errorBodyOf(error)?.error?.message ?? '';

export const orNullOn = (code: string) => (error: unknown) => {
  if (apiErrorCode(error) !== code) throw error;
  return null;
};
