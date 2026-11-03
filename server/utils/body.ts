import type { H3Event } from 'h3';

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
