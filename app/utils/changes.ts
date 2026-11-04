import type { ChangeField, IssueChange, IssueComment } from '~/types/api';

export type TextField = 'title' | 'body' | 'name' | 'testInstructions';

export interface ChangeGroup {
  kind: 'group'
  id: number
  actor: string
  origin: IssueChange['origin']
  at: string
  changes: IssueChange[]
}

export interface CommentEntry {
  kind: 'comment'
  id: number
  at: string
  comment: IssueComment
}

export type ThreadEntry = ChangeGroup | CommentEntry;

export interface FieldEdit {
  field: ChangeField
  before: string | null
  after: string | null
}

export interface DiffLine {
  kind: 'same' | 'added' | 'removed'
  text: string
}

const MERGE_WINDOW_MS = 5 * 60 * 1000;
const TEXT_FIELDS: ChangeField[] = ['title', 'body', 'name', 'testInstructions'];

export const isTextField = (field: ChangeField): field is TextField => TEXT_FIELDS.includes(field);

const mergesInto = (group: ChangeGroup, change: IssueChange) =>
  group.actor === change.actor
  && group.origin === change.origin
  && Date.parse(change.at) - Date.parse(group.changes[group.changes.length - 1]!.at) <= MERGE_WINDOW_MS;

export const threadEntries = (changes: IssueChange[], comments: IssueComment[]): ThreadEntry[] => {
  const events: ({ kind: 'single', at: string, change: IssueChange } | CommentEntry)[] = [
    ...changes.map(change => ({ kind: 'single' as const, at: change.at, change })),
    ...comments.map(comment => ({ kind: 'comment' as const, id: comment.id, at: comment.createdAt, comment })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const entries: ThreadEntry[] = [];
  for (const event of events) {
    const last = entries[entries.length - 1];
    if (event.kind === 'comment') {
      entries.push(event);
    }
    else if (last?.kind === 'group' && mergesInto(last, event.change)) {
      last.changes.push(event.change);
    }
    else {
      const { id, actor, origin, at } = event.change;
      entries.push({ kind: 'group', id, actor, origin, at, changes: [event.change] });
    }
  }
  return entries;
};

export const changeGroups = (changes: IssueChange[]) => threadEntries(changes, []).filter((entry): entry is ChangeGroup => entry.kind === 'group');

export const groupEdits = (group: ChangeGroup): FieldEdit[] => {
  const edits: FieldEdit[] = [];
  for (const { field, before, after } of group.changes) {
    const collapsed = isTextField(field) ? edits.find(edit => edit.field === field) : undefined;
    if (collapsed) collapsed.after = after;
    else edits.push({ field, before, after });
  }
  return edits;
};

export const blockerLabel = (value: string) => (value.startsWith('#') ? value : `#${value}`);

export const linkTitle = (value: string) => {
  try {
    const { title } = JSON.parse(value) as { title?: unknown };
    return typeof title === 'string' ? title : value;
  }
  catch {
    return value;
  }
};

const linesOf = (text: string) => (text === '' ? [] : text.split('\n'));

export const lineDiff = (before: string, after: string): DiffLine[] => {
  const left = linesOf(before);
  const right = linesOf(after);
  const longest: number[][] = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      longest[i]![j] = left[i] === right[j] ? longest[i + 1]![j + 1]! + 1 : Math.max(longest[i + 1]![j]!, longest[i]![j + 1]!);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      lines.push({ kind: 'same', text: left[i]! });
      i++;
      j++;
    }
    else if (j < right.length && (i >= left.length || longest[i]![j + 1]! > longest[i + 1]![j]!)) {
      lines.push({ kind: 'added', text: right[j]! });
      j++;
    }
    else {
      lines.push({ kind: 'removed', text: left[i]! });
      i++;
    }
  }
  return lines;
};
