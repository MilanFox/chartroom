import { describe, expect, it } from 'vitest';
import { issueFixture } from '~/test/issue-fixture';
import { groupByEffort } from './workbench-groups';

const row = (number: number, effort: number | null, day: string) => issueFixture({ number, effort, updatedAt: `2026-11-0${day}T00:00:00.000Z` });

describe('groupByEffort', () => {
  it('orders groups by their most recently updated issue and keeps the rows in the order the API sorted them', () => {
    const rows = [row(3, 1, '1'), row(8, 20, '2'), row(5, 1, '4'), row(9, null, '3'), { ...row(20, null, '1'), kind: 'effort' as const }];

    const groups = groupByEffort(rows);

    expect(groups.map(group => [group.effort, group.rows.map(({ number }) => number)])).toEqual([
      [1, [3, 5]],
      [null, [9]],
      [20, [8, 20]],
    ]);
  });
});
