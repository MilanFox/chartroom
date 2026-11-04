import { describe, expect, it } from 'vitest';
import { adoptionConflictOf, claimConflictOf, versionConflictOf } from './conflict';

const apiFailure = (code: string, message: string, field?: string) => ({ data: { error: { code, message, ...(field ? { field } : {}) } } });

describe('versionConflictOf', () => {
  it('names who last wrote a stale issue and when, from the server conflict', () => {
    const failure = apiFailure('conflict', 'issue #12 is at version 4, last written by claude-a at 2026-11-04T09:12:00.000Z', 'version');

    expect(versionConflictOf(failure)).toEqual({ holder: 'claude-a', at: '2026-11-04T09:12:00.000Z' });
  });

  it('still reports a stale save whose message names nobody', () => {
    expect(versionConflictOf(apiFailure('conflict', 'stale', 'version'))).toEqual({ holder: null, at: null });
  });

  it('is null for any other failure', () => {
    expect(versionConflictOf(apiFailure('conflict', 'Effort #1 already has map #2', 'parent'))).toBeNull();
    expect(versionConflictOf(apiFailure('invalid', 'parent must be an issue number or null', 'parent'))).toBeNull();
    expect(versionConflictOf(new Error('offline'))).toBeNull();
  });
});

describe('claimConflictOf', () => {
  it('names the holder of an issue someone else claimed first', () => {
    expect(claimConflictOf(apiFailure('conflict', 'issue #12 is held by claude-b', 'assignee'))).toEqual({ holder: 'claude-b' });
  });

  it('still reports a claim conflict whose message names nobody', () => {
    expect(claimConflictOf(apiFailure('conflict', 'taken', 'assignee'))).toEqual({ holder: null });
  });

  it('is null for any other failure', () => {
    expect(claimConflictOf(apiFailure('invalid', 'issue #12 is closed', 'state'))).toBeNull();
  });
});

describe('adoptionConflictOf', () => {
  it('lists the issues that would carry two members of the group', () => {
    expect(adoptionConflictOf(apiFailure('conflict', '#3, #12 would carry two members of priority'))).toEqual([3, 12]);
  });

  it('is null for a taken id or any other failure', () => {
    expect(adoptionConflictOf(apiFailure('conflict', 'label group priority already exists', 'id'))).toBeNull();
    expect(adoptionConflictOf(apiFailure('invalid', 'number is a built-in sort or filter key', 'id'))).toBeNull();
    expect(adoptionConflictOf(new Error('offline'))).toBeNull();
  });
});
