import type { H3Event } from 'h3';
import type { EnvironmentRecord, PointerRecord } from '../utils/environments';
import type { HolderRecord } from '../utils/holders';
import type { BlockerRef } from '../utils/blockers';
import type { CommentRecord } from '../utils/comments';
import type { IssueRecord } from '../utils/issues';
import type { LinkRecord } from '../utils/links';
import type { ResearchNoteRecord } from '../utils/research-notes';
import type { RolledUpNoteRecord } from '../utils/efforts';
import type { CredentialPointer, EffortDocument, ExcerptedRow, Environment, Holder, IssueComment, IssueDocument, IssueLink, IssueRow, Origin, ResearchNote, ResearchNoteSummary, RolledUpResearchNote, RosterHolder } from '#shared/api';
import type { IssueState, Kind, LinkRole, LinkType } from '#shared/domain';
import { STATUSES } from '#shared/domain';
import type { JsonSchema } from './table';
import { nullable, pageSchema, stringList } from './schemas';

interface RowRelations {
  labels: string[]
  blockers: BlockerRef[]
  effort: number | null
}

const relationsOf = (issue: IssueRecord): RowRelations => ({ labels: labelsOf(issue.number), blockers: blockersOf(issue.number), effort: effortNumberOf(issue) });

export const toRow = (event: H3Event, issue: IssueRecord, relations?: RowRelations): IssueRow => {
  const { labels, blockers, effort } = relations ?? relationsOf(issue);
  return {
    number: issue.number,
    kind: issue.kind as Kind,
    title: issue.title,
    state: issue.state as IssueState,
    status: statusOf(issue, blockers),
    assignee: issue.assignee,
    parent: issue.parent,
    effort,
    labels,
    blockedBy: blockers.map(({ number, open }) => ({ number, open })),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    url: `${baseUrl(event)}/issues/${issue.number}`,
  };
};

export const toDocument = (event: H3Event, issue: IssueRecord): IssueDocument => {
  const resolution = resolutionOf(issue.number);
  const relations = relationsOf(issue);
  return {
    ...toRow(event, issue, relations),
    body: issue.body,
    createdBy: issue.createdBy,
    origin: issue.origin as Origin,
    closedAt: issue.closedAt,
    version: issue.version,
    blockedBy: relations.blockers,
    blocks: blocksOf(issue.number),
    children: childNumbers(issue.number),
    links: linksOf(issue.number).map(toLink),
    comments: commentsOf(issue.number).map(comment => toComment(event, comment)),
    resolution: resolution === null ? null : toComment(event, resolution),
    ...(issue.kind === 'effort' ? { name: issue.name, testInstructions: issue.testInstructions } : {}),
  };
};

export const toRows = (event: H3Event, records: IssueRecord[]): IssueRow[] => {
  const numbers = records.map(issue => issue.number);
  const labels = labelsByIssue(numbers);
  const blockers = blockersByIssue(numbers);
  const efforts = effortsByIssue(numbers);
  return records.map(issue => toRow(event, issue, { labels: labels.get(issue.number) ?? [], blockers: blockers.get(issue.number) ?? [], effort: efforts.get(issue.number) ?? null }));
};

export const toComment = (event: H3Event, comment: CommentRecord): IssueComment => ({
  id: comment.id,
  issue: comment.issue,
  author: comment.author,
  body: comment.body,
  origin: comment.origin as Origin,
  resolution: comment.resolution,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  url: `${baseUrl(event)}/issues/${comment.issue}#comment-${comment.id}`,
});

const COMMENT_PROPERTIES = {
  id: { type: 'integer' },
  issue: { type: 'integer' },
  author: { type: 'string' },
  body: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  resolution: { type: 'boolean', description: 'Set only through close; the Resolution of the issue' },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  url: { type: 'string', format: 'uri' },
};

export const COMMENT_SCHEMA = { type: 'object', properties: COMMENT_PROPERTIES, required: Object.keys(COMMENT_PROPERTIES) };

export const toLink = (link: LinkRecord): IssueLink => ({
  id: link.id,
  issue: link.issue,
  role: link.role as LinkRole,
  type: link.type as LinkType,
  url: link.url,
  title: link.title,
  addedBy: link.addedBy,
  origin: link.origin as Origin,
  createdAt: link.createdAt,
});

export const LINK_FIELDS = {
  role: { type: 'string', enum: LINK_ROLES },
  type: { type: 'string', enum: LINK_TYPES, description: 'external is the fallback' },
  title: { type: 'string' },
};

const LINK_PROPERTIES = {
  id: { type: 'integer' },
  issue: { type: 'integer' },
  ...LINK_FIELDS,
  url: { type: 'string', format: 'uri', description: 'The target; a Link has no tracker address' },
  addedBy: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  createdAt: { type: 'string', format: 'date-time' },
};

export const LINK_SCHEMA = { type: 'object', properties: LINK_PROPERTIES, required: Object.keys(LINK_PROPERTIES) };

const researchNoteUrl = (event: H3Event, issue: number, slug: string) => `${baseUrl(event)}/issues/${issue}/research/${slug}`;

export const toResearchNoteSummary = (event: H3Event, note: ResearchNoteRecord): ResearchNoteSummary => ({
  issue: note.issue,
  slug: note.slug,
  title: note.title,
  size: note.size,
  createdAt: note.createdAt,
  createdBy: note.createdBy,
  updatedAt: note.updatedAt,
  updatedBy: note.updatedBy,
  origin: note.origin as Origin,
  url: researchNoteUrl(event, note.issue, note.slug),
});

export const toResearchNote = (event: H3Event, note: ResearchNoteRecord): ResearchNote => ({ ...toResearchNoteSummary(event, note), body: note.body });

const toRolledUpResearchNote = (event: H3Event, note: RolledUpNoteRecord): RolledUpResearchNote => ({
  issue: { number: note.issue.number, title: note.issue.title, kind: note.issue.kind as Kind },
  slug: note.slug,
  title: note.title,
  size: note.size,
  updatedAt: note.updatedAt,
  url: researchNoteUrl(event, note.issue.number, note.slug),
});

const RESEARCH_NOTE_SUMMARY_PROPERTIES = {
  issue: { type: 'integer' },
  slug: { type: 'string' },
  title: { type: 'string', description: 'The text of the first # heading, else the slug' },
  size: { type: 'integer', description: 'Bytes of the UTF-8 body' },
  createdAt: { type: 'string', format: 'date-time' },
  createdBy: { type: 'string' },
  updatedAt: { type: 'string', format: 'date-time' },
  updatedBy: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  url: { type: 'string', format: 'uri', description: 'The page of the note' },
};

export const RESEARCH_NOTE_SUMMARY_SCHEMA = { type: 'object', properties: RESEARCH_NOTE_SUMMARY_PROPERTIES, required: Object.keys(RESEARCH_NOTE_SUMMARY_PROPERTIES) };

const RESEARCH_NOTE_PROPERTIES = { ...RESEARCH_NOTE_SUMMARY_PROPERTIES, body: { type: 'string' } };

export const RESEARCH_NOTE_SCHEMA = { type: 'object', properties: RESEARCH_NOTE_PROPERTIES, required: Object.keys(RESEARCH_NOTE_PROPERTIES) };

const issueRef = (properties: Record<string, unknown>) => ({ type: 'object', properties: { number: { type: 'integer' }, ...properties }, required: ['number', ...Object.keys(properties)] });
const BLOCKER_LIST = { type: 'array', items: issueRef({ open: { type: 'boolean' } }), description: 'Blockers by number; open means the blocker still blocks' };

const ROW_PROPERTIES = {
  number: { type: 'integer' },
  kind: { type: 'string', enum: KINDS },
  title: { type: 'string' },
  state: { type: 'string', enum: ['open', 'closed'] },
  status: { type: 'string', enum: STATUSES },
  assignee: nullable('string'),
  parent: nullable('integer'),
  effort: nullable('integer'),
  labels: stringList,
  blockedBy: BLOCKER_LIST,
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  url: { type: 'string', format: 'uri' },
};

export const ROW_SCHEMA = { type: 'object', properties: ROW_PROPERTIES, required: Object.keys(ROW_PROPERTIES) };

const DOCUMENT_PROPERTIES = {
  ...ROW_PROPERTIES,
  body: { type: 'string' },
  createdBy: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  closedAt: nullable('string'),
  version: { type: 'integer' },
  blockedBy: { ...BLOCKER_LIST, items: issueRef({ title: { type: 'string' }, open: { type: 'boolean' } }) },
  blocks: { type: 'array', items: issueRef({ title: { type: 'string' } }), description: 'The issues this one blocks' },
  children: { type: 'array', items: { type: 'integer' } },
  links: { type: 'array', items: LINK_SCHEMA },
  comments: { type: 'array', items: COMMENT_SCHEMA },
  resolution: { oneOf: [COMMENT_SCHEMA, { type: 'null' }] },
  name: { ...nullable('string'), description: 'Effort only' },
  testInstructions: { ...nullable('string'), description: 'Effort only' },
};

export const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: DOCUMENT_PROPERTIES,
  required: Object.keys(DOCUMENT_PROPERTIES).filter(key => key !== 'name' && key !== 'testInstructions'),
};

const CHANGE_PROPERTIES = {
  id: { type: 'integer' },
  issue: { type: 'integer' },
  actor: { type: 'string' },
  origin: { type: 'string', enum: ['ui', 'api'] },
  at: { type: 'string', format: 'date-time' },
  field: { type: 'string' },
  before: nullable('string'),
  after: nullable('string'),
};

export const CHANGE_SCHEMA = { type: 'object', properties: CHANGE_PROPERTIES, required: Object.keys(CHANGE_PROPERTIES) };

const EFFORT_COUNT_SCHEMA = { type: 'object', properties: { effort: nullable('integer'), count: { type: 'integer' } }, required: ['effort', 'count'] };

const ROW_PAGE_SCHEMA = pageSchema(ROW_SCHEMA);

export const ISSUE_PAGE_SCHEMA = {
  ...ROW_PAGE_SCHEMA,
  properties: {
    ...ROW_PAGE_SCHEMA.properties,
    effortCounts: { type: 'array', items: EFFORT_COUNT_SCHEMA, description: 'Per Effort, how many issues match the filters across every page; an Effort counts toward itself, null collects issues outside any Effort; ordered by Effort number, null first' },
  },
  required: [...ROW_PAGE_SCHEMA.required, 'effortCounts'],
};

export const toPointer = (pointer: PointerRecord): CredentialPointer => ({
  id: pointer.id,
  label: pointer.label,
  accountName: pointer.accountName,
  whereToFind: pointer.whereToFind,
  environment: pointer.environment,
});

export const toEnvironment = (environment: EnvironmentRecord, pointers: PointerRecord[] | null): Environment => ({
  id: environment.id,
  name: environment.name,
  url: environment.url,
  notes: environment.notes,
  ...(pointers ? { credentialPointers: pointers.filter(pointer => pointer.environment === environment.id).map(toPointer) } : {}),
});

const POINTER_PROPERTIES = {
  id: { type: 'integer' },
  label: { type: 'string' },
  accountName: { type: 'string' },
  whereToFind: { type: 'string' },
  environment: { type: ['integer', 'null'], description: 'The bound Environment id, null for any environment' },
};

export const POINTER_SCHEMA = { type: 'object', properties: POINTER_PROPERTIES, required: Object.keys(POINTER_PROPERTIES) };

const ENVIRONMENT_PROPERTIES = {
  id: { type: 'integer' },
  name: { type: 'string' },
  url: { type: 'string' },
  notes: { type: ['string', 'null'] },
  credentialPointers: { type: 'array', items: POINTER_SCHEMA, description: 'Omitted for a non-elevated Viewer' },
};

export const ENVIRONMENT_SCHEMA = { type: 'object', properties: ENVIRONMENT_PROPERTIES, required: ['id', 'name', 'url', 'notes'] };

export const basicHolder = (holder: HolderRecord): Holder => ({
  slug: holder.slug,
  displayName: holder.displayName,
  revoked: holder.revokedAt !== null,
});

export const fullHolder = (holder: HolderRecord): Required<RosterHolder> => ({
  ...basicHolder(holder),
  createdAt: holder.createdAt,
  revokedAt: holder.revokedAt,
  lastUsedAt: holder.lastUsedAt,
  updatedAt: holder.updatedAt,
  updatedBy: holder.updatedBy,
  secretHistory: secretHistoryOf(holder.slug).map(({ hash, createdAt, revokedAt }) => ({ hash, createdAt, revokedAt })),
});

const HOLDER_PROPERTIES = {
  slug: { type: 'string' },
  displayName: { type: ['string', 'null'] },
  revoked: { type: 'boolean' },
  createdAt: { type: 'string' },
  revokedAt: { type: ['string', 'null'] },
  lastUsedAt: { type: ['string', 'null'] },
  updatedAt: { type: 'string' },
  updatedBy: { type: 'string' },
  secretHistory: { type: 'array', items: { type: 'object', properties: { hash: { type: 'string' }, createdAt: { type: 'string' }, revokedAt: { type: ['string', 'null'] } } } },
};
export const HOLDER_SCHEMA: JsonSchema = { type: 'object', properties: HOLDER_PROPERTIES, required: ['slug', 'displayName', 'revoked'] };
export const HOLDER_WITH_SECRET_SCHEMA: JsonSchema = { type: 'object', properties: { ...HOLDER_PROPERTIES, secret: { type: 'string' } }, required: ['slug', 'displayName', 'revoked', 'secret'] };

const toExcerptedRow = (event: H3Event, issue: IssueRecord): ExcerptedRow => ({ ...toRow(event, issue), excerpt: bodyExcerpt(issue.body) });

export const toEffortDocument = (event: H3Event, effort: IssueRecord): EffortDocument => {
  const children = childrenOf(effort.number);
  const map = children.find(child => child.kind === 'map');
  return {
    ...toDocument(event, effort),
    name: effort.name,
    testInstructions: effort.testInstructions,
    statusRollup: statusRollupOf(effort.number),
    linkRollup: linkRollupOf(effort.number),
    researchRollup: researchRollupOf(effort.number).map(note => toRolledUpResearchNote(event, note)),
    map: map ? toExcerptedRow(event, map) : null,
    specs: children.filter(child => child.kind === 'spec').map(spec => toExcerptedRow(event, spec)),
  };
};

const countRecord = { type: 'object', additionalProperties: { type: 'integer' } };

const STATUS_ROLLUP_SCHEMA = {
  type: 'object',
  description: 'Computed, never stored',
  properties: {
    map: { oneOf: [{ type: 'object', properties: { state: { type: 'string', enum: ['open', 'closed'] }, frontier: { type: 'integer', description: 'Open, unassigned children of the map with no open blocker' } }, required: ['state', 'frontier'] }, { type: 'null' }] },
    specs: { type: 'array', items: { type: 'object', properties: { number: { type: 'integer' }, tickets: { ...countRecord, description: 'The children of the spec by status' } }, required: ['number', 'tickets'] } },
    triage: { ...countRecord, description: 'Tickets parented straight to the Effort, one bucket per triage-state member plus none' },
    open: { type: 'integer', description: 'Open issues in the subtree, the Effort itself excluded' },
  },
  required: ['map', 'specs', 'triage', 'open'],
};

const ROLLED_UP_LINK_SCHEMA = {
  type: 'object',
  properties: { url: LINK_SCHEMA.properties.url, title: { type: 'string' }, type: LINK_SCHEMA.properties.type, sources: { type: 'array', items: { type: 'integer' }, description: 'Every issue in the subtree carrying the URL' } },
  required: ['url', 'title', 'type', 'sources'],
};

const ROLLED_UP_RESEARCH_NOTE_SCHEMA = {
  type: 'object',
  properties: {
    issue: issueRef({ title: { type: 'string' }, kind: { type: 'string', enum: KINDS } }),
    slug: RESEARCH_NOTE_SUMMARY_PROPERTIES.slug,
    title: RESEARCH_NOTE_SUMMARY_PROPERTIES.title,
    size: RESEARCH_NOTE_SUMMARY_PROPERTIES.size,
    updatedAt: RESEARCH_NOTE_SUMMARY_PROPERTIES.updatedAt,
    url: RESEARCH_NOTE_SUMMARY_PROPERTIES.url,
  },
  required: ['issue', 'slug', 'title', 'size', 'updatedAt', 'url'],
};

const EXCERPTED_ROW_SCHEMA = {
  type: 'object',
  properties: { ...ROW_PROPERTIES, excerpt: { type: 'string', description: 'The first body paragraph that is not a heading or an HTML comment, whitespace collapsed; empty when there is none' } },
  required: [...ROW_SCHEMA.required, 'excerpt'],
};

const EFFORT_DOCUMENT_PROPERTIES = {
  ...DOCUMENT_SCHEMA.properties,
  statusRollup: STATUS_ROLLUP_SCHEMA,
  linkRollup: { type: 'object', description: 'Every Link in the subtree, closed tickets included, deduped by URL', properties: { resource: { type: 'array', items: ROLLED_UP_LINK_SCHEMA }, artifact: { type: 'array', items: ROLLED_UP_LINK_SCHEMA } }, required: ['resource', 'artifact'] },
  researchRollup: { type: 'array', description: 'Every Research note in the subtree, the Effort itself included, newest updatedAt first', items: ROLLED_UP_RESEARCH_NOTE_SCHEMA },
  map: { oneOf: [EXCERPTED_ROW_SCHEMA, { type: 'null' }] },
  specs: { type: 'array', items: EXCERPTED_ROW_SCHEMA },
};

export const EFFORT_DOCUMENT_SCHEMA = { type: 'object', properties: EFFORT_DOCUMENT_PROPERTIES, required: [...DOCUMENT_SCHEMA.required, 'name', 'testInstructions', 'statusRollup', 'linkRollup', 'researchRollup', 'map', 'specs'] };
export const EFFORT_PAGE_SCHEMA = pageSchema(EFFORT_DOCUMENT_SCHEMA);
