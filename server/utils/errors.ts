export type ErrorCode = 'not-found' | 'conflict' | 'invalid' | 'forbidden' | 'unauthenticated' | 'rate-limited';

interface ApiErrorInit {
  status: number
  code: ErrorCode
  message: string
  field?: string
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly field: string | undefined;

  constructor({ status, code, message, field }: ApiErrorInit) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }

  toBody() {
    return { error: { code: this.code, message: this.message, ...(this.field ? { field: this.field } : {}) } };
  }
}

export const notFound = (message: string) => new ApiError({ status: 404, code: 'not-found', message });
export const conflict = (message: string, field?: string) => new ApiError({ status: 409, code: 'conflict', message, field });
export const invalid = (message: string, field?: string) => new ApiError({ status: 400, code: 'invalid', message, field });
export const forbidden = (message: string) => new ApiError({ status: 403, code: 'forbidden', message });
export const unauthenticated = (message: string) => new ApiError({ status: 401, code: 'unauthenticated', message });
export const rateLimited = (message: string) => new ApiError({ status: 429, code: 'rate-limited', message });
export const unsupportedMediaType = () => new ApiError({ status: 415, code: 'invalid', message: 'request body must be application/json' });
