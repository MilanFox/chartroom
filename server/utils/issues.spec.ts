import { describe, expect, it } from 'vitest';
import { assertParentAllowed, PARENT_RULES, statusOf } from './issues';
import type { IssueRecord } from './issues';

const issueWith = (fields: Partial<IssueRecord>) => ({ state: 'open', assignee: null, ...fields }) as IssueRecord;
const openBlocker = { number: 2, title: 'b', open: true };
const closedBlocker = { number: 3, title: 'c', open: false };

describe('statusOf', () => {
  it.each([
    [{ state: 'closed', assignee: 'ada' }, [openBlocker], 'closed'],
    [{ assignee: 'ada' }, [openBlocker], 'blocked'],
    [{}, [closedBlocker, openBlocker], 'blocked'],
    [{}, [closedBlocker], 'open'],
    [{}, [], 'open'],
    [{ assignee: 'ada' }, [closedBlocker], 'claimed'],
  ] as const)('%j with blockers %j is %s', (fields, blockers, expected) => {
    expect(statusOf(issueWith(fields), [...blockers])).toBe(expected);
  });
});

describe('PARENT_RULES', () => {
  it('lets only tickets sit under a map and nothing sit under a ticket', () => {
    expect(Object.entries(PARENT_RULES).filter(([, parents]) => parents.includes('map')).map(([kind]) => kind)).toEqual(['ticket']);
    expect(Object.values(PARENT_RULES).some(parents => parents.includes('ticket'))).toBe(false);
  });

  it('gives an Effort no parent kind', () => {
    expect(PARENT_RULES.effort).toEqual([]);
  });
});

describe('assertParentAllowed without a parent', () => {
  it('accepts an Effort and a ticket', () => {
    expect(() => assertParentAllowed('effort', null, null)).not.toThrow();
    expect(() => assertParentAllowed('ticket', null, null)).not.toThrow();
  });

  it.each(['map', 'spec'] as const)('needs an Effort as parent for a %s', (kind) => {
    expect(() => assertParentAllowed(kind, null, null)).toThrowError(expect.objectContaining({ code: 'invalid', field: 'parent' }));
  });
});

describe('assertParentAllowed with a parent', () => {
  it('refuses a parent for an Effort', () => {
    expect(() => assertParentAllowed('effort', 1, null)).toThrowError(expect.objectContaining({ code: 'invalid', field: 'parent' }));
  });
});
