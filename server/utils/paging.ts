export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export type Query = Record<string, unknown>;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const queryString = (query: Query, key: string) => {
  const value = query[key];
  if (value === undefined) return null;
  if (typeof value !== 'string') throw invalid(`${key} must be given once`, key);
  return value;
};

export const queryStrings = (query: Query, key: string): string[] => {
  const value = query[key];
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  if (!values.every(item => typeof item === 'string')) throw invalid(`${key} must be a string`, key);
  return values;
};

export const queryOneOf = <T extends string>(query: Query, key: string, allowed: readonly T[]): T | null => {
  const raw = queryString(query, key);
  return raw === null ? null : oneOf(raw, key, allowed);
};

export const pageLimit = (query: Query) => {
  const raw = queryString(query, 'limit');
  if (raw === null) return DEFAULT_LIMIT;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw invalid(`limit must be an integer from 1 to ${MAX_LIMIT}`, 'limit');
  return limit;
};

export const encodeCursor = (key: unknown[]) => Buffer.from(JSON.stringify(key)).toString('base64url');

const parseCursor = (raw: string): unknown => {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  }
  catch {
    return null;
  }
};

export const decodeCursor = (query: Query): unknown[] | null => {
  const raw = queryString(query, 'cursor');
  if (raw === null) return null;
  const key = parseCursor(raw);
  if (!Array.isArray(key)) throw invalid('cursor is not valid', 'cursor');
  return key;
};

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
export const pageOf = <T>(rows: T[], limit: number, keyOf: (row: T) => unknown[]): Page<T> => {
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeCursor(keyOf(items[items.length - 1]!)) : null;
  return { items, nextCursor };
};
