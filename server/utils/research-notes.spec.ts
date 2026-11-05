import { describe, expect, it } from 'vitest';
import { assertNoteBody, assertNoteSlug, noteSizeOf, noteTitleOf, RESEARCH_NOTE_MAX_BYTES } from './research-notes';

const invalidOn = (field: string) => expect.objectContaining({ code: 'invalid', field });

describe('assertNoteSlug', () => {
  it.each(['local-transcription', 'a', 'v2-notes'])('accepts %s', (slug) => {
    expect(assertNoteSlug(slug)).toBe(slug);
  });

  it.each(['', 'Upper', 'snake_case', '-lead', 'trail-', 'two--dashes', 'with space', 'notes.md'])('refuses %j on slug', (slug) => {
    expect(() => assertNoteSlug(slug)).toThrowError(invalidOn('slug'));
  });
});

describe('assertNoteBody', () => {
  it('accepts text up to the cap counted in UTF-8 bytes', () => {
    expect(RESEARCH_NOTE_MAX_BYTES).toBe(524_288);
    expect(() => assertNoteBody('a'.repeat(RESEARCH_NOTE_MAX_BYTES))).not.toThrow();
    expect(() => assertNoteBody('é'.repeat(RESEARCH_NOTE_MAX_BYTES / 2))).not.toThrow();
  });

  it.each([
    ['one byte over the cap', 'a'.repeat(RESEARCH_NOTE_MAX_BYTES + 1)],
    ['multi-byte text over the cap', 'é'.repeat(RESEARCH_NOTE_MAX_BYTES / 2 + 1)],
    ['a NUL byte', '# Notes\0'],
  ])('refuses %s on body, pointing at an Artifact Link', (_, body) => {
    expect(() => assertNoteBody(body)).toThrowError(invalidOn('body'));
    expect(() => assertNoteBody(body)).toThrowError(/chartroom issue link add <n> --role artifact/);
  });
});

describe('noteSizeOf', () => {
  it('counts UTF-8 bytes', () => {
    expect(noteSizeOf('aé✓')).toBe(6);
  });
});

describe('noteTitleOf', () => {
  it.each([
    ['# Local transcription\n\nBody', 'Local transcription'],
    ['Intro\n\n## Section\n\n# Later title  \n', 'Later title'],
    ['# Closed heading ##', 'Closed heading'],
    ['#NoSpace\n## Only second level', 'slug'],
    ['', 'slug'],
  ])('%j is titled %j', (body, title) => {
    expect(noteTitleOf('slug', body)).toBe(title);
  });
});
