import type { H3Event } from 'h3';

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
export const numericParam = (event: H3Event, name: string, describe: (raw: string) => string) => {
  const raw = getRouterParam(event, name) ?? '';
  if (!/^\d+$/.test(raw)) throw notFound(describe(raw));
  return Number(raw);
};

export const textParam = (event: H3Event, name: string) => getRouterParam(event, name, { decode: true }) ?? '';

export const issueNumberParam = (event: H3Event) => numericParam(event, 'number', raw => `issue #${raw} does not exist`);

export const commentIdParam = (event: H3Event) => numericParam(event, 'id', raw => `comment ${raw} does not exist`);

export const blockerNumberParam = (event: H3Event) => numericParam(event, 'blocker', raw => `issue #${raw} does not exist`);

export const labelParam = (event: H3Event) => {
  const label = textParam(event, 'label').trim();
  if (label === '') throw invalid('label must not be blank', 'label');
  return label;
};

export const effortHandleParam = (event: H3Event) => textParam(event, 'handle');

export const linkIdParam = (event: H3Event) => numericParam(event, 'id', raw => `link ${raw} does not exist`);
