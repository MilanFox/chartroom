import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const labelGroups = sqliteTable('label_groups', {
  id: text().primaryKey(),
  displayName: text('display_name').notNull(),
  position: integer().notNull(),
  seeded: integer({ mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at'),
  updatedBy: text('updated_by'),
});

export const labelGroupMembers = sqliteTable('label_group_members', {
  id: text().primaryKey(),
  groupId: text('group_id').notNull().references(() => labelGroups.id, { onDelete: 'cascade' }),
  displayLabel: text('display_label').notNull(),
  position: integer().notNull(),
});

export const holders = sqliteTable('holders', {
  slug: text().primaryKey(),
  displayName: text('display_name'),
  createdAt: text('created_at').notNull(),
  revokedAt: text('revoked_at'),
  lastUsedAt: text('last_used_at'),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const holderSecrets = sqliteTable('holder_secrets', {
  id: integer().primaryKey({ autoIncrement: true }),
  holderSlug: text('holder_slug').notNull().references(() => holders.slug, { onDelete: 'cascade' }),
  hash: text().notNull().unique(),
  createdAt: text('created_at').notNull(),
  revokedAt: text('revoked_at'),
});

export const sessions = sqliteTable('sessions', {
  id: text().primaryKey(),
  holderSlug: text('holder_slug').references(() => holders.slug, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  adminUntil: text('admin_until'),
});

export const issues = sqliteTable('issues', {
  number: integer().primaryKey({ autoIncrement: true }),
  kind: text().notNull(),
  title: text().notNull(),
  body: text().notNull().default(''),
  state: text().notNull().default('open'),
  assignee: text(),
  parent: integer(),
  name: text().unique(),
  testInstructions: text('test_instructions'),
  createdBy: text('created_by').notNull(),
  origin: text().notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  closedAt: text('closed_at'),
  version: integer().notNull().default(1),
});

export const changes = sqliteTable('changes', {
  id: integer().primaryKey({ autoIncrement: true }),
  issue: integer().notNull().references(() => issues.number, { onDelete: 'cascade' }),
  actor: text().notNull(),
  origin: text().notNull(),
  at: text('at').notNull(),
  field: text().notNull(),
  before: text(),
  after: text(),
});

export const comments = sqliteTable('comments', {
  id: integer().primaryKey({ autoIncrement: true }),
  issue: integer().notNull().references(() => issues.number, { onDelete: 'cascade' }),
  author: text().notNull(),
  body: text().notNull(),
  origin: text().notNull(),
  resolution: integer({ mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const issueLabels = sqliteTable('issue_labels', {
  issue: integer().notNull().references(() => issues.number, { onDelete: 'cascade' }),
  label: text().notNull(),
}, table => [primaryKey({ columns: [table.issue, table.label] })]);

export const issueBlockers = sqliteTable('issue_blockers', {
  issue: integer().notNull().references(() => issues.number, { onDelete: 'cascade' }),
  blocker: integer().notNull().references(() => issues.number, { onDelete: 'cascade' }),
}, table => [primaryKey({ columns: [table.issue, table.blocker] })]);

export const links = sqliteTable('links', {
  id: integer().primaryKey({ autoIncrement: true }),
  issue: integer().notNull().references(() => issues.number, { onDelete: 'cascade' }),
  role: text().notNull(),
  type: text().notNull(),
  url: text().notNull(),
  title: text().notNull(),
  addedBy: text('added_by').notNull(),
  origin: text().notNull(),
  createdAt: text('created_at').notNull(),
}, table => [unique().on(table.issue, table.url)]);

export const researchNotes = sqliteTable('research_notes', {
  id: integer().primaryKey({ autoIncrement: true }),
  issue: integer().notNull().references(() => issues.number, { onDelete: 'cascade' }),
  slug: text().notNull(),
  title: text().notNull(),
  body: text().notNull(),
  size: integer().notNull(),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
  origin: text().notNull(),
}, table => [unique().on(table.issue, table.slug)]);

export const instanceSettings = sqliteTable('instance_settings', {
  id: integer().primaryKey(),
  projectName: text('project_name').notNull(),
  effortSingular: text('effort_singular').notNull(),
  effortPlural: text('effort_plural'),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const environments = sqliteTable('environments', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  url: text().notNull(),
  notes: text(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const credentialPointers = sqliteTable('credential_pointers', {
  id: integer().primaryKey({ autoIncrement: true }),
  label: text().notNull(),
  accountName: text('account_name').notNull(),
  whereToFind: text('where_to_find').notNull(),
  environment: integer().references(() => environments.id, { onDelete: 'set null' }),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});
