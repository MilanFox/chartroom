import { describe, expect, it } from 'vitest';
import { fetchFailure } from '~/test/endpoints';
import { memberClashOf, claimConflictOf, versionConflictOf } from './conflict';

describe('versionConflictOf', () => {
  it('names who last wrote a stale issue and when, from the server conflict', () => {
    const failure = fetchFailure({ code: 'conflict', message: 'issue #12 is at version 4, last written by claude-a at 2026-11-04T09:12:00.000Z', field: 'version', details: { version: 4, lastWrittenBy: 'claude-a', lastWrittenAt: '2026-11-04T09:12:00.000Z' } });

    expect(versionConflictOf(failure)).toEqual({ holder: 'claude-a', at: '2026-11-04T09:12:00.000Z' });
  });

  it('still reports a stale save whose message names nobody', () => {
    expect(versionConflictOf(fetchFailure({ code: 'conflict', message: 'stale', field: 'version' }))).toEqual({ holder: null, at: null });
  });

  it('is null for any other failure', () => {
    expect(versionConflictOf(fetchFailure({ code: 'conflict', message: 'Effort #1 already has map #2', field: 'parent' }))).toBeNull();
    expect(versionConflictOf(fetchFailure({ code: 'invalid', message: 'parent must be an issue number or null', field: 'parent' }))).toBeNull();
    expect(versionConflictOf(new Error('offline'))).toBeNull();
  });
});

describe('claimConflictOf', () => {
  it('names the holder of an issue someone else claimed first', () => {
    expect(claimConflictOf(fetchFailure({ code: 'conflict', message: 'issue #12 is held by claude-b', field: 'assignee', details: { assignee: 'claude-b' } }))).toEqual({ holder: 'claude-b' });
  });

  it('still reports a claim conflict whose message names nobody', () => {
    expect(claimConflictOf(fetchFailure({ code: 'conflict', message: 'taken', field: 'assignee' }))).toEqual({ holder: null });
  });

  it('is null for any other failure', () => {
    expect(claimConflictOf(fetchFailure({ code: 'invalid', message: 'issue #12 is closed', field: 'state' }))).toBeNull();
  });
});

describe('memberClashOf', () => {
  it('lists the issues that would carry two members of the group', () => {
    expect(memberClashOf(fetchFailure({ code: 'conflict', message: '#3, #12 would carry two members of priority', field: 'labels', details: { group: 'priority', issues: [3, 12], truncated: false } }))).toEqual([3, 12]);
  });

  it('is null for a taken id or any other failure', () => {
    expect(memberClashOf(fetchFailure({ code: 'conflict', message: 'label group priority already exists', field: 'id' }))).toBeNull();
    expect(memberClashOf(fetchFailure({ code: 'conflict', message: 'holder x is revoked' }))).toBeNull();
    expect(memberClashOf(fetchFailure({ code: 'invalid', message: 'number is a built-in sort or filter key', field: 'id' }))).toBeNull();
    expect(memberClashOf(new Error('offline'))).toBeNull();
  });
});
