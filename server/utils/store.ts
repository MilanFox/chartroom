import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

export type Store = BetterSQLite3Database<typeof schema>;

const BUSY_TIMEOUT_MS = 5000;

let current: Store | undefined;

export const storeFile = (dataDir: string) => join(dataDir, 'chartroom.sqlite');

export const openStore = (dataDir: string) => {
  mkdirSync(backupsDir(dataDir), { recursive: true });
  const sqlite = new Database(storeFile(dataDir), { timeout: BUSY_TIMEOUT_MS });
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  current = drizzle(sqlite, { schema });
  return current;
};

export const useStore = () => {
  if (!current) throw new Error('store is not open');
  return current;
};
