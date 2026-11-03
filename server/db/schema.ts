import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const labelGroups = sqliteTable('label_groups', {
  id: text().primaryKey(),
  displayName: text('display_name').notNull(),
  position: integer().notNull(),
  seeded: integer({ mode: 'boolean' }).notNull().default(false),
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
