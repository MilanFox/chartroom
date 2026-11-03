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
