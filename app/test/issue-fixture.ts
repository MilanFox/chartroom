import type { IssueDocument } from '~/types/api';

export const issueFixture = (overrides: Partial<IssueDocument> = {}): IssueDocument => ({
  number: 12,
  kind: 'ticket',
  title: 'Issue view',
  state: 'open',
  status: 'open',
  assignee: null,
  parent: 2,
  effort: 1,
  labels: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  url: 'http://localhost/issues/12',
  body: 'First draft',
  createdBy: 'milan',
  origin: 'api',
  closedAt: null,
  version: 3,
  blockedBy: [],
  blocks: [],
  children: [],
  links: [],
  comments: [],
  resolution: null,
  ...overrides,
});

export const holderSession = { slug: 'milan', displayName: 'Milan', viewer: false, admin: null };

export const viewerSession = { slug: null, displayName: null, viewer: true, admin: null };

export const apiFailure = (status: number, { code, message, field, details }: { code: string, message: string, field?: string, details?: Record<string, unknown> }) => () =>
  new Response(JSON.stringify({ error: { code, message, ...(field ? { field } : {}), ...(details ? { details } : {}) } }), { status, headers: { 'content-type': 'application/json' } });
