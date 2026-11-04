import { describe, expect, it } from 'vitest';
import { releaseNotes } from './release-notes.ts';

describe('releaseNotes', () => {
  it('groups commits by conventional type, features first', () => {
    const commits = [
      { hash: 'a1', subject: 'fix: keep the session on reload' },
      { hash: 'b2', subject: 'feat: add the admin page' },
      { hash: 'c3', subject: 'feat(cli): add the adapter verb' },
    ];
    expect(releaseNotes(commits)).toBe([
      '## Features',
      '',
      '- add the admin page (b2)',
      '- **cli:** add the adapter verb (c3)',
      '',
      '## Fixes',
      '',
      '- keep the session on reload (a1)',
      '',
    ].join('\n'));
  });

  it('lists breaking changes on top, still under their own type', () => {
    const commits = [
      { hash: 'a1', subject: 'feat: add labels' },
      { hash: 'b2', subject: 'feat(api)!: drop the v0 issue shape' },
    ];
    expect(releaseNotes(commits)).toBe([
      '## Breaking changes',
      '',
      '- **api:** drop the v0 issue shape (b2)',
      '',
      '## Features',
      '',
      '- add labels (a1)',
      '- **api:** drop the v0 issue shape (b2)',
      '',
    ].join('\n'));
  });

  it('collects other types and non-conventional subjects under Other changes', () => {
    const commits = [
      { hash: 'a1', subject: 'docs: add the release procedure' },
      { hash: 'b2', subject: 'Bump the base image' },
      { hash: 'c3', subject: 'fix: keep the session' },
    ];
    expect(releaseNotes(commits)).toBe([
      '## Fixes',
      '',
      '- keep the session (c3)',
      '',
      '## Other changes',
      '',
      '- docs: add the release procedure (a1)',
      '- Bump the base image (b2)',
      '',
    ].join('\n'));
  });

  it('says so when there is nothing to list', () => {
    expect(releaseNotes([])).toBe('No changes since the previous release.\n');
  });
});
