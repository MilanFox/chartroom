import { describe, expect, it } from 'vitest';
import { environmentGroups } from './environment-groups';

const environment = (id: number, name: string) => ({ id, name, url: 'https://example.test', notes: '' });

describe('environmentGroups', () => {
  it('groups pointers under their environment and puts unbound pointers last under the any label', () => {
    const groups = environmentGroups(
      [environment(1, 'Staging'), environment(2, 'Prod')],
      [{ environment: 2 }, { environment: null }, { environment: 1 }],
      'Any environment',
    );

    expect(groups.map(({ key, name, pointers }) => ({ key, name, count: pointers.length }))).toEqual([
      { key: 'environment-1', name: 'Staging', count: 1 },
      { key: 'environment-2', name: 'Prod', count: 1 },
      { key: 'any', name: 'Any environment', count: 1 },
    ]);
  });

  it('omits the any group when every pointer is bound', () => {
    expect(environmentGroups([environment(1, 'Staging')], [{ environment: 1 }], 'Any environment')).toHaveLength(1);
  });
});
