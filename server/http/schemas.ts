export const nullable = (type: string) => ({ type: [type, 'null'] });
export const stringList = { type: 'array', items: { type: 'string' } };

export const pageSchema = (item: Record<string, unknown>) => ({
  type: 'object',
  properties: { items: { type: 'array', items: item }, nextCursor: nullable('string') },
  required: ['items', 'nextCursor'],
});

export const ISSUE_NUMBER_PARAM = { name: 'number', in: 'path' as const, required: true, schema: { type: 'integer' } };
export const BLOCKER_NUMBER_PARAM = { name: 'blocker', in: 'path' as const, required: true, schema: { type: 'integer' } };
export const LABEL_PARAM = { name: 'label', in: 'path' as const, required: true, schema: { type: 'string' }, description: 'URL-encoded, trimmed, non-blank' };

export const PAGING_PARAMS = [
  { name: 'limit', in: 'query' as const, schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
  { name: 'cursor', in: 'query' as const, schema: { type: 'string' }, description: 'The nextCursor of the previous page' },
];
