import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Store } from '../utils/store';

interface Journal {
  entries: { idx: number, tag: string, when: number }[]
}

interface Migration {
  index: string
  tag: string
  when: number
  hash: string
  statements: string[]
}

const MIGRATIONS_TABLE = '__drizzle_migrations';
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

const readMigrations = async (): Promise<Migration[]> => {
  const assets = useStorage('assets:migrations');
  const journal = await assets.getItem<Journal>('meta/_journal.json');
  if (!journal) throw new Error('migrations journal is missing from the build');
  return Promise.all(journal.entries.map(async ({ idx, tag, when }) => {
    const sqlText = await assets.getItem<string>(`${tag}.sql`);
    if (typeof sqlText !== 'string') throw new Error(`migration ${tag} is missing from the build`);
    return {
      index: String(idx).padStart(4, '0'),
      tag,
      when,
      hash: createHash('sha256').update(sqlText).digest('hex'),
      statements: sqlText.split(STATEMENT_BREAKPOINT),
    };
  }));
};

export const readMigrationState = async (store: Store) => {
  const migrations = await readMigrations();
  store.run(sql.raw(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`));
  const appliedTimes = store.all<{ created_at: number }>(sql.raw(`SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at`)).map(row => Number(row.created_at));
  const lastApplied = appliedTimes.at(-1);
  return {
    unknownApplied: appliedTimes.some(appliedAt => !migrations.some(migration => migration.when === appliedAt)),
    lastAppliedIndex: migrations.find(migration => migration.when === lastApplied)?.index ?? null,
    imageIndex: migrations.at(-1)?.index ?? null,
    pending: migrations.filter(migration => lastApplied === undefined || lastApplied < migration.when),
  };
};

export const migrateStore = (store: Store, pending: Migration[]) => {
  store.transaction((tx) => {
    for (const migration of pending) {
      for (const statement of migration.statements) tx.run(sql.raw(statement));
      tx.run(sql.raw(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES ('${migration.hash}', ${migration.when})`));
    }
  });
  return pending.map(migration => migration.tag);
};
