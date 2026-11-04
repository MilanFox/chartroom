import { describe, expect, it } from 'vitest';
import { memberClashOf, claimConflictOf, versionConflictOf } from './conflict';

const apiFailure = (code: string, message: string, { field, details }: { field?: string, details?: Record<string, unknown> } = {}) => ({ data: { error: { code, message, ...(field ? { field } : {}), ...(details ? { details } : {}) } } });

describe('versionConflictOf', () => {
  it('names who last wrote a stale issue and when, from the server conflict', () => {
    const failure = apiFailure('conflict', 'issue #12 is at version 4, last written by claude-a at 2026-11-04T09:12:00.000Z', { field: 'version', details: { version: 4, lastWrittenBy: 'claude-a', lastWrittenAt: '2026-11-04T09:12:00.000Z' } });

    expect(versionConflictOf(failure)).toEqual({ holder: 'claude-a', at: '2026-11-04T09:12:00.000Z' });
  });

  it('still reports a stale save whose message names nobody', () => {
    expect(versionConflictOf(apiFailure('conflict', 'stale', { field: 'version' }))).toEqual({ holder: null, at: null });
  });

  it('is null for any other failure', () => {
    expect(versionConflictOf(apiFailure('conflict', 'Effort #1 already has map #2', { field: 'parent' }))).toBeNull();
    expect(versionConflictOf(apiFailure('invalid', 'parent must be an issue number or null', { field: 'parent' }))).toBeNull();
    expect(versionConflictOf(new Error('offline'))).toBeNull();
  });
});

describe('claimConflictOf', () => {
  it('names the holder of an issue someone else claimed first', () => {
    expect(claimConflictOf(apiFailure('conflict', 'issue #12 is held by claude-b', { field: 'assignee', details: { assignee: 'claude-b' } }))).toEqual({ holder: 'claude-b' });
  });

  it('still reports a claim conflict whose message names nobody', () => {
    expect(claimConflictOf(apiFailure('conflict', 'taken', { field: 'assignee' }))).toEqual({ holder: null });
  });

  it('is null for any other failure', () => {
    expect(claimConflictOf(apiFailure('invalid', 'issue #12 is closed', { field: 'state' }))).toBeNull();
  });
});

describe('memberClashOf', () => {
  it('lists the issues that would carry two members of the group', () => {
    expect(memberClashOf(apiFailure('conflict', '#3, #12 would carry two members of priority', { field: 'labels', details: { group: 'priority', issues: [3, 12], truncated: false } }))).toEqual([3, 12]);
  });

  it('is null for a taken id or any other failure', () => {
    expect(memberClashOf(apiFailure('conflict', 'label group priority already exists', { field: 'id' }))).toBeNull();
    expect(memberClashOf(apiFailure('conflict', 'holder x is revoked'))).toBeNull();
    expect(memberClashOf(apiFailure('invalid', 'number is a built-in sort or filter key', { field: 'id' }))).toBeNull();
    expect(memberClashOf(new Error('offline'))).toBeNull();
  });
});
