import type { ApiErrorBody } from '~/types/api';

const errorBodyOf = (error: unknown) => (error as { data?: Partial<ApiErrorBody> } | null)?.data;

export const apiErrorCode = (error: unknown) => errorBodyOf(error)?.error?.code ?? null;

export const apiErrorField = (error: unknown) => errorBodyOf(error)?.error?.field ?? null;
