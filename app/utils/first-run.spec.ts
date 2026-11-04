import { describe, expect, it } from 'vitest';
import { firstRunChecklist } from './first-run';

describe('firstRunChecklist', () => {
  it('asks a fresh Instance only for the first Token holder, linking to its section', () => {
    expect(firstRunChecklist({ holders: 0 })).toEqual([{ id: 'holder', section: 'holders', done: false }]);
  });

  it('strikes the holder step with the first holder', () => {
    expect(firstRunChecklist({ holders: 1 })).toEqual([{ id: 'holder', section: 'holders', done: true }]);
  });
});
