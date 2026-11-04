import { describe, expect, it } from 'vitest';
import type { IssueChange, IssueComment } from '~/types/api';
import type { ChangeGroup } from './changes';
import { groupEdits, lineDiff, threadEntries } from './changes';

const at = (minute: number) => `2026-11-04T10:${String(minute).padStart(2, '0')}:00.000Z`;

const change = (id: number, minute: number, overrides: Partial<IssueChange> = {}): IssueChange => ({
  id,
  issue: 12,
  actor: 'milan',
  origin: 'ui',
  at: at(minute),
  field: 'title',
  before: 'A',
  after: 'B',
  ...overrides,
});

const comment = (id: number, minute: number): IssueComment => ({
  id,
  issue: 12,
  author: 'claude-a',
  body: `Comment ${id}`,
  origin: 'api',
  resolution: false,
  createdAt: at(minute),
  updatedAt: at(minute),
  url: `http://localhost/issues/12#comment-${id}`,
});

describe('threadEntries', () => {
  it('merges consecutive Changes by one holder within the window into one row and keeps the thread in time order', () => {
    const entries = threadEntries([
      change(1, 0, { field: 'title', before: 'A', after: 'B' }),
      change(2, 1, { field: 'body', before: 'one', after: 'two' }),
      change(3, 2, { field: 'label', before: null, after: 'bug' }),
      change(4, 9, { actor: 'claude-a', origin: 'api', field: 'label', before: null, after: 'needs-info' }),
    ], [comment(1, 5)]);

    expect(entries).toMatchObject([
      { kind: 'group', actor: 'milan', origin: 'ui', at: at(0), changes: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      { kind: 'comment', comment: { id: 1 } },
      { kind: 'group', actor: 'claude-a', origin: 'api', at: at(9), changes: [{ id: 4 }] },
    ]);
  });

  it('starts a new row past the window, on another holder, and after a comment', () => {
    const entries = threadEntries([
      change(1, 0),
      change(2, 6),
      change(3, 7, { actor: 'claude-a', origin: 'api' }),
      change(4, 8, { actor: 'claude-a', origin: 'api' }),
      change(5, 9, { actor: 'claude-a', origin: 'api' }),
    ], [comment(1, 8)]);

    expect(entries.map(entry => (entry.kind === 'group' ? entry.changes.map(merged => merged.id) : 'comment'))).toEqual([[1], [2], [3, 4], 'comment', [5]]);
  });

  it('collapses repeated edits of one text field into one before and after, and keeps set-like Changes apart', () => {
    const [group] = threadEntries([
      change(1, 0, { field: 'body', before: 'one', after: 'two' }),
      change(2, 1, { field: 'body', before: 'two', after: 'three' }),
      change(3, 2, { field: 'label', before: null, after: 'bug' }),
      change(4, 3, { field: 'body', before: 'three', after: 'four' }),
      change(5, 4, { field: 'label', before: 'bug', after: null }),
    ], []);

    expect(groupEdits(group as ChangeGroup)).toEqual([
      { field: 'body', before: 'one', after: 'four' },
      { field: 'label', before: null, after: 'bug' },
      { field: 'label', before: 'bug', after: null },
    ]);
  });
});

describe('lineDiff', () => {
  it('marks removed and added lines and keeps unchanged lines in place', () => {
    expect(lineDiff('a\nb\nc', 'a\nc\nd')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'same', text: 'c' },
      { kind: 'added', text: 'd' },
    ]);
  });

  it('shows a replaced line as removed then added, and a fresh body as all added', () => {
    expect(lineDiff('x', 'y')).toEqual([{ kind: 'removed', text: 'x' }, { kind: 'added', text: 'y' }]);
    expect(lineDiff('', 'a\nb')).toEqual([{ kind: 'added', text: 'a' }, { kind: 'added', text: 'b' }]);
  });

  it('diffs a representative body edit', () => {
    const before = '# Title\n\n## Notes\n\nfirst\n\n## Done\n\n- a\n';
    const after = '# Title\n\n## Notes\n\nfirst\nsecond\n\n## Done\n\n- b\n';

    expect(lineDiff(before, after).filter(line => line.kind !== 'same')).toEqual([
      { kind: 'added', text: 'second' },
      { kind: 'removed', text: '- a' },
      { kind: 'added', text: '- b' },
    ]);
    expect(lineDiff(before, after).filter(line => line.kind === 'same')).toHaveLength(9);
  });
});
