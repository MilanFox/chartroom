import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import type { IssueChange } from '~/types/api';
import ChangeRow from './ChangeRow.vue';

const researchChange = (before: string | null, after: string): IssueChange => ({
  id: 1,
  issue: 12,
  actor: 'tester',
  origin: 'api',
  at: '2026-11-05T04:28:00.000Z',
  field: 'research',
  before,
  after,
});

const mountRow = (change: IssueChange) =>
  mountSuspended(ChangeRow, { props: { group: { kind: 'group', id: change.id, actor: change.actor, origin: change.origin, at: change.at, changes: [change] } } });

describe('ChangeRow', () => {
  it('words a first Research note put as added, linking the slug to the note page', async () => {
    const wrapper = await mountRow(researchChange(null, 'findings (158 bytes)'));

    expect(wrapper.get('.change-row__phrase').text()).toBe('added Research note findings (158 B)');
    expect(wrapper.get('.change-row__phrase a').attributes('href')).toBe('/issues/12/research/findings');
  });

  it('words a later put as updated, with the size before and after', async () => {
    const wrapper = await mountRow(researchChange('findings (158 bytes)', 'findings (2048 bytes)'));

    expect(wrapper.get('.change-row__phrase').text()).toBe('updated Research note findings (158 B → 2 KB)');
    expect(wrapper.get('.change-row__phrase a').text()).toBe('findings');
  });
});
