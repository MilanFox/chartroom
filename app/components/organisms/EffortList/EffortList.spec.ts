import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import type { Effort } from '~/types/api';
import EffortList from './EffortList.vue';

const effort = (number: number, title: string, overrides: Partial<Effort> = {}): Effort => ({
  number,
  name: title.toLowerCase().replace(/\s+/g, '-'),
  title,
  state: 'open',
  status: 'open',
  labels: [],
  createdBy: 'milan',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  statusRollup: { map: null, specs: [], triage: {}, open: 0 },
  ...overrides,
});

const efforts = [
  effort(1, 'Tracker', { labels: ['client-a', 'frontend'] }),
  effort(2, 'Archive', { state: 'closed', status: 'closed', labels: ['client-a'] }),
  effort(3, 'Docs', { labels: ['frontend'] }),
];

const mountList = () => mountSuspended(EffortList, { props: { efforts } });
const rowTitles = (wrapper: Awaited<ReturnType<typeof mountList>>) => wrapper.findAll('tbody tr a').map(link => link.text());

describe('EffortList', () => {
  it('links each open Effort to its dashboard, newest first, closed ones hidden', async () => {
    const wrapper = await mountList();

    expect(wrapper.findAll('tbody tr a').map(link => link.attributes('href'))).toEqual(['/efforts/3', '/efforts/1']);
  });

  it('sorts by a header button, marking the column with aria-sort and toggling on a second press', async () => {
    const wrapper = await mountList();
    const nameHeader = () => wrapper.findAll('th').find(th => th.text().startsWith('Title'))!;

    expect(wrapper.get('th[aria-sort]').text()).toContain('#');
    expect(wrapper.get('th[aria-sort]').attributes('aria-sort')).toBe('descending');

    await nameHeader().get('button').trigger('click');
    expect(nameHeader().attributes('aria-sort')).toBe('ascending');
    expect(wrapper.findAll('th[aria-sort]')).toHaveLength(1);
    expect(rowTitles(wrapper)).toEqual(['Docs', 'Tracker']);

    await nameHeader().get('button').trigger('click');
    expect(nameHeader().attributes('aria-sort')).toBe('descending');
    expect(rowTitles(wrapper)).toEqual(['Tracker', 'Docs']);
  });

  it('narrows by pressed tag chips with AND and shows closed Efforts on the toggle', async () => {
    const wrapper = await mountList();
    const chip = (tag: string) => wrapper.findAll('button[aria-pressed]').find(button => button.text() === tag)!;

    await chip('client-a').trigger('click');
    expect(chip('client-a').attributes('aria-pressed')).toBe('true');
    expect(rowTitles(wrapper)).toEqual(['Tracker']);

    await wrapper.get('input[type="checkbox"]').setValue(true);
    expect(rowTitles(wrapper)).toEqual(['Archive', 'Tracker']);

    await chip('frontend').trigger('click');
    expect(rowTitles(wrapper)).toEqual(['Tracker']);
  });

  it('says so when the search matches nothing', async () => {
    const wrapper = await mountList();

    await wrapper.get('input[type="search"]').setValue('nothing like this');

    expect(wrapper.find('tbody tr a').exists()).toBe(false);
    expect(wrapper.text()).toContain('No Efforts match');
  });
});
