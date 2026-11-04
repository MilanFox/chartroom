import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { clearNuxtData } from '#app';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IssueDocument, IssueRow } from '~/types/api';
import { useIssuesStore } from '~/stores/issues';
import { issueFixture } from '~/test/issue-fixture';
import DependencyGraph from './DependencyGraph.vue';

const unregister: (() => void)[] = [];

const child = (number: number, overrides: Partial<IssueRow> = {}): IssueRow => ({
  number,
  kind: 'ticket',
  title: `Ticket ${number}`,
  state: 'open',
  status: 'open',
  assignee: null,
  parent: 30,
  effort: 1,
  labels: [],
  blockedBy: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  url: `http://localhost/issues/${number}`,
  ...overrides,
});

const CHILDREN = [
  child(31, { title: 'Name the product', state: 'closed', status: 'closed', labels: ['wayfinder:prototype'] }),
  child(32, { title: 'Data model', status: 'claimed', assignee: 'claude-a', labels: ['wayfinder:grilling'], blockedBy: [{ number: 31, open: false }] }),
  child(33, { title: 'HTTP API shape', status: 'blocked', blockedBy: [{ number: 32, open: true }] }),
  child(34, { title: 'Inspect the starter', labels: ['wayfinder:research'] }),
];

const mountGraph = async (overrides: Partial<IssueDocument>) => {
  const pages = [{ items: CHILDREN.slice(0, 2), nextCursor: 'next' }, { items: CHILDREN.slice(2), nextCursor: null }];
  unregister.push(registerEndpoint('/ui/issues', { method: 'GET', handler: event => pages[new URL((event as { web: { request: Request } }).web.request.url).searchParams.has('cursor') ? 1 : 0] }));
  useIssuesStore().children = {};
  const wrapper = await mountSuspended(DependencyGraph, { props: { issue: issueFixture({ number: 30, parent: 1, ...overrides }) } });
  await vi.waitFor(() => expect(wrapper.findAll('a')).toHaveLength(CHILDREN.length));
  return wrapper;
};

const nodeLabels = (wrapper: Awaited<ReturnType<typeof mountGraph>>) => wrapper.findAll('a').map(link => link.attributes('aria-label'));

describe('DependencyGraph', () => {
  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
    clearNuxtData();
    localStorage.clear();
  });

  it('opens on an open map with the progress header and every child as a link naming its number, title, state, mark and open blockers', async () => {
    const wrapper = await mountGraph({ kind: 'map' });

    expect(wrapper.find('button[aria-expanded]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.text()).toContain('1 of 4 closed · frontier 1 · claimed 1 · blocked 1');
    expect(nodeLabels(wrapper).sort()).toEqual([
      '#31 Name the product, closed',
      '#32 Data model, claimed by @claude-a',
      '#33 HTTP API shape, blocked, blocked by #32',
      '#34 Inspect the starter, open, frontier',
    ]);
    expect(wrapper.find('a[aria-label^="#33 HTTP API shape"]').attributes('href')).toBe('/issues/33');
  });

  it('marks the Frontier, names the holder of a claim and shows type glyphs on a map', async () => {
    const wrapper = await mountGraph({ kind: 'map' });

    expect(wrapper.find('a[aria-label^="#34 Inspect the starter"]').text()).toContain('frontier');
    expect(wrapper.find('a[aria-label^="#34 Inspect the starter"]').text()).toContain('🔎');
    expect(wrapper.find('a[aria-label^="#33 HTTP API shape"]').text()).not.toContain('frontier');
    expect(wrapper.find('a[aria-label^="#32 Data model"]').text()).toContain('@claude-a');
  });

  it('starts collapsed on a spec, labels its open unblocked tickets takeable and shows no glyphs', async () => {
    const wrapper = await mountGraph({ kind: 'spec' });

    expect(wrapper.find('button[aria-expanded]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.text()).toContain('takeable 1');
    expect(wrapper.find('a[aria-label^="#34 Inspect the starter"]').text()).toContain('takeable');
    expect(wrapper.find('a[aria-label^="#34 Inspect the starter"]').attributes('aria-label')).toBe('#34 Inspect the starter, open, takeable');
    expect(wrapper.find('a[aria-label^="#34 Inspect the starter"]').text()).not.toContain('🔎');
  });

  it('hides closed tickets on request and says how many it hides', async () => {
    const wrapper = await mountGraph({ kind: 'map' });
    const toggle = wrapper.find('button[role="switch"]');

    expect(toggle.text()).toBe('hide closed (1)');
    await toggle.trigger('click');

    expect(toggle.attributes('aria-checked')).toBe('true');
    expect(nodeLabels(wrapper).sort()).toEqual([
      '#32 Data model, claimed by @claude-a',
      '#33 HTTP API shape, blocked, blocked by #32',
      '#34 Inspect the starter, open, frontier',
    ]);
  });
});
