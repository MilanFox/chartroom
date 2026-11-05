import { and, asc, eq } from 'drizzle-orm';
import { researchNotes } from '../db/schema';
import type { Caller } from './caller';
import { invalid, notFound } from './errors';
import { LOWERCASE_SLUG_SHAPE } from './issues';

export type ResearchNoteRecord = typeof researchNotes.$inferSelect;

export const RESEARCH_NOTE_MAX_BYTES = 512 * 1024;

const ARTIFACT_HINT = 'binaries and large files belong in an Artifact Link (chartroom issue link add <n> --role artifact …)';

export const assertNoteSlug = (slug: string) => {
  if (!LOWERCASE_SLUG_SHAPE.test(slug)) throw invalid('slug must be lowercase letters and digits in dash-separated words', 'slug');
  return slug;
};

export const noteSizeOf = (body: string) => Buffer.byteLength(body, 'utf8');

export const assertNoteBody = (body: string) => {
  if (body.includes('\0')) throw invalid(`body must be Markdown text, not binary; ${ARTIFACT_HINT}`, 'body');
  if (noteSizeOf(body) > RESEARCH_NOTE_MAX_BYTES) throw invalid(`body must be at most ${RESEARCH_NOTE_MAX_BYTES} bytes; ${ARTIFACT_HINT}`, 'body');
  return body;
};

export const noteTitleOf = (slug: string, body: string) => /^# +(.+?)\s*$/m.exec(body)?.[1]?.replace(/\s+#+$/, '') || slug;

const loggedNote = (slug: string, size: number) => `${slug} (${size} bytes)`;

const findNote = (issue: number, slug: string) =>
  useStore().select().from(researchNotes).where(and(eq(researchNotes.issue, issue), eq(researchNotes.slug, slug))).get() ?? null;

export const notesOf = (issue: number): ResearchNoteRecord[] => {
  requireIssue(issue);
  return useStore().select().from(researchNotes).where(eq(researchNotes.issue, issue)).orderBy(asc(researchNotes.slug)).all();
};

export const requireNote = (issue: number, slug: string): ResearchNoteRecord => {
  requireIssue(issue);
  const note = findNote(issue, slug);
  if (!note) throw notFound(`research note #${issue}/${slug} does not exist`);
  return note;
};

export interface NoteRef {
  issue: number
  slug: string
}

export const putNote = ({ issue, slug }: NoteRef, body: string, caller: Caller) => {
  assertNoteSlug(slug);
  assertNoteBody(body);
  requireIssue(issue);
  const existing = findNote(issue, slug);
  const fields = { title: noteTitleOf(slug, body), body, size: noteSizeOf(body) };
  recordIssueWrite(issue, caller, (tx, { actor, origin, at }) => {
    const stamp = { updatedAt: at, updatedBy: actor };
    if (existing) tx.update(researchNotes).set({ ...fields, ...stamp }).where(eq(researchNotes.id, existing.id)).run();
    else tx.insert(researchNotes).values({ issue, slug, ...fields, ...stamp, origin, createdAt: at, createdBy: actor }).run();
    return [{ field: 'research', before: existing ? loggedNote(slug, existing.size) : null, after: loggedNote(slug, fields.size) }];
  });
  return { note: findNote(issue, slug)!, created: !existing };
};
