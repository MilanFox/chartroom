import type { H3Event } from 'h3';
import type { Caller } from '../../utils/caller';
import { toResearchNote, toResearchNoteSummary } from '../representations';
import { issueNumberParam, textParam } from './params';

const noteList = (event: H3Event) => notesOf(issueNumberParam(event)).map(note => toResearchNoteSummary(event, note));

const noteRead = (event: H3Event) => toResearchNote(event, requireNote(issueNumberParam(event), textParam(event, 'slug')));

const notePut = async (event: H3Event, caller: Caller) => {
  const ref = { issue: issueNumberParam(event), slug: textParam(event, 'slug') };
  const { note, created } = putNote(ref, anyString(await readJsonObject(event), 'body'), caller);
  setResponseStatus(event, created ? 201 : 200);
  return toResearchNote(event, note);
};

export const researchNoteHandlers = {
  list: noteList,
  read: noteRead,
  put: notePut,
};

export const RESEARCH_SLUG_PARAM = { name: 'slug', in: 'path' as const, required: true, schema: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' }, description: 'Unique per issue, the same shape as an Effort slug' };

export const RESEARCH_NOTE_BODY_SCHEMA = { type: 'object', properties: { body: { type: 'string', description: `Markdown text, at most ${RESEARCH_NOTE_MAX_BYTES} bytes UTF-8, no NUL byte` } }, required: ['body'] };
