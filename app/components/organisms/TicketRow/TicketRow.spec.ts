import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import type { IssueRow } from '~/types/api';
import TicketRow from './TicketRow.vue';

const rowFixture = (overrides: Partial<IssueRow> = {}): IssueRow => ({
  number: 12,
  kind: 'ticket',
  title: 'Issue view',
  state: 'open',
  status: 'open',
  assignee: null,
  parent: 2,
  effort: 1,
  labels: [],
  blockedBy: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  url: 'http://localhost/issues/12',
  ...overrides,
});

const mountRow = (row: IssueRow) => mountSuspended(TicketRow, { props: { row } });

describe('TicketRow', () => {
  it('links the title to the ticket page', async () => {
    const wrapper = await mountRow(rowFixture());

    const link = wrapper.get('a.ticket-row__title');
    expect(link.text()).toBe('Issue view');
    expect(link.attributes('href')).toBe('/issues/12');
  });

  it('puts a Preview button naming the ticket right after the link, and opens the drawer from it', async () => {
    const wrapper = await mountRow(rowFixture());

    const focusable = wrapper.findAll('a, button');
    expect(focusable[0]!.element.tagName).toBe('A');
    const preview = focusable[1]!;
    expect(preview.element.tagName).toBe('BUTTON');
    expect(preview.attributes('aria-label')).toBe('Preview #12 Issue view');

    await preview.trigger('click');
    expect(wrapper.emitted('open')).toEqual([[12]]);
  });

  it('does not open the drawer when the link is clicked', async () => {
    const wrapper = await mountRow(rowFixture());

    await wrapper.get('a.ticket-row__title').trigger('click');
    expect(wrapper.emitted('open')).toBeUndefined();
  });
});
