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
