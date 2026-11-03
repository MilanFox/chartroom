import type { H3Event } from 'h3';

export const issueNumberParam = (event: H3Event) => {
  const raw = getRouterParam(event, 'number') ?? '';
  if (!/^\d+$/.test(raw)) throw notFound(`issue #${raw} does not exist`);
  return Number(raw);
};

export const commentIdParam = (event: H3Event) => {
  const raw = getRouterParam(event, 'id') ?? '';
  if (!/^\d+$/.test(raw)) throw notFound(`comment ${raw} does not exist`);
  return Number(raw);
};

export const blockerNumberParam = (event: H3Event) => {
  const raw = getRouterParam(event, 'blocker') ?? '';
  if (!/^\d+$/.test(raw)) throw notFound(`issue #${raw} does not exist`);
  return Number(raw);
};

export const labelParam = (event: H3Event) => {
  const label = (getRouterParam(event, 'label', { decode: true }) ?? '').trim();
  if (label === '') throw invalid('label must not be blank', 'label');
  return label;
};

export const effortHandleParam = (event: H3Event) => getRouterParam(event, 'handle', { decode: true }) ?? '';

export const linkIdParam = (event: H3Event) => {
  const raw = getRouterParam(event, 'id') ?? '';
  if (!/^\d+$/.test(raw)) throw notFound(`link ${raw} does not exist`);
  return Number(raw);
};
