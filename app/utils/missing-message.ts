export const missingMessageOf = (error: unknown, number: number, messages: { notFound: string, loadFailed: string }) =>
  (apiErrorCode(error) === 'not-found' || !Number.isInteger(number) ? messages.notFound : messages.loadFailed);
