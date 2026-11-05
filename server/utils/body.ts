import type { H3Event } from 'h3';
import type { LinkType } from '#shared/domain';

export type JsonObject = Record<string, unknown>;

export const readJsonObject = async (event: H3Event): Promise<JsonObject> => {
  const raw = await readRawBody(event, 'utf8');
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  }
  catch {
    throw invalid('request body is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw invalid('request body must be a JSON object');
  return parsed as JsonObject;
};

export const oneOf = <T extends string>(value: unknown, field: string, allowed: readonly T[]): T => {
  if (!allowed.includes(value as T)) throw invalid(`${field} must be one of ${allowed.join(', ')}`, field);
  return value as T;
};

export const requireString = (body: JsonObject, field: string) => {
  const value = body[field];
  if (typeof value !== 'string' || value === '') throw invalid(`${field} must be a non-empty string`, field);
  return value;
};

export const optionalString = (body: JsonObject, field: string) => {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw invalid(`${field} must be a string`, field);
  return value;
};

export const requireText = (body: JsonObject, field: string) => {
  const value = requireString(body, field);
  if (value.trim() === '') throw invalid(`${field} must not be blank`, field);
  return value;
};

export const nestedObject = (body: JsonObject, field: string): JsonObject => {
  const value = body[field];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid(`${field} must be an object`, field);
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [`${field}.${key}`, inner]));
};

export const absoluteUrl = (body: JsonObject) => {
  const value = body.url;
  if (typeof value !== 'string' || !URL.canParse(value)) throw invalid('url must be an absolute URL', 'url');
  return value;
};

export const linkTarget = (body: JsonObject, type: LinkType) => {
  const value = body.url;
  const nameOrPath = typeof value === 'string' && value.trim() !== '' && !value.startsWith('/') && /^(branch|file)$/.test(type);
  return nameOrPath ? value.trim() : absoluteUrl(body);
};

export const optionalText = (body: JsonObject, field: string) => (body[field] ?? null) === null ? null : requireText(body, field);

export const anyString = (body: JsonObject, field: string) => {
  const value = body[field];
  if (typeof value !== 'string') throw invalid(`${field} must be a string`, field);
  return value;
};

export const stringArray = (body: JsonObject, field: string, { nonBlank = false } = {}) => {
  const value = body[field];
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && (!nonBlank || item.trim() !== ''))) throw invalid(`${field} must be an array of ${nonBlank ? 'non-blank strings' : 'ids'}`, field);
  return value as string[];
};
