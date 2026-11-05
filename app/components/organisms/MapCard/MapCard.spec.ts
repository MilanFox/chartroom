import { mountSuspended } from '@nuxt/test-utils/runtime';
import { clearNuxtData } from '#app';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEndpoints } from '~/test/endpoints';
import type { ExcerptedRow, IssueRow } from '~/types/api';
import { useIssuesStore } from '~/stores/issues';
import MapCard from './MapCard.vue';

const endpoint = useEndpoints();

const rowFixture = (number: number, overrides: Partial<IssueRow> = {}): IssueRow => ({
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

const MAP_ROW = { ...rowFixture(30, { kind: 'map', title: 'The map', parent: null }), excerpt: '' } as ExcerptedRow;
const CHILDREN = [rowFixture(31), rowFixture(32, { status: 'blocked', blockedBy: [{ number: 31, open: true }] })];

const mountCard = async () => {
  endpoint('/ui/issues', { method: 'GET', handler: () => ({ items: CHILDREN, nextCursor: null }) });
  useIssuesStore().children = {};
  const wrapper = await mountSuspended(MapCard, { props: { map: MAP_ROW, frontier: 1, rows: CHILDREN } });
  const viewButton = (name: string) => wrapper.findAll('[role="group"] button').find(button => button.text() === name)!;
  return { wrapper, viewButton };
};

describe('MapCard view toggle', () => {
  afterEach(() => {
    clearNuxtData();
    localStorage.clear();
  });

  it('shows the list by default with the list button pressed', async () => {
    const { wrapper, viewButton } = await mountCard();

    expect(viewButton('List').attributes('aria-pressed')).toBe('true');
    expect(viewButton('Graph').attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('.map-card__rows').exists()).toBe(true);
    expect(wrapper.find('.dependency-graph__canvas').exists()).toBe(false);
  });

  it('switches to the graph of the same tickets and back to the list', async () => {
    const { wrapper, viewButton } = await mountCard();

    await viewButton('Graph').trigger('click');
    await vi.waitFor(() => expect(wrapper.findAll('.dependency-graph__canvas a')).toHaveLength(CHILDREN.length));
    expect(wrapper.find('.dependency-graph__canvas').isVisible()).toBe(true);
    expect(wrapper.find('.dependency-graph button[aria-expanded]').exists()).toBe(false);
    expect(viewButton('Graph').attributes('aria-pressed')).toBe('true');
    expect(viewButton('List').attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('.map-card__rows').exists()).toBe(false);

    await viewButton('List').trigger('click');
    expect(viewButton('List').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('.dependency-graph__canvas').exists()).toBe(false);
    expect(wrapper.findAll('.map-card__row')).toHaveLength(CHILDREN.length);
  });
});
