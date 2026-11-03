import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Store } from '../utils/store';

interface Journal {
  entries: { tag: string, when: number }[]
}

interface Migration {
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
  return Promise.all(journal.entries.map(async ({ tag, when }) => {
    const sqlText = await assets.getItem<string>(`${tag}.sql`);
    if (typeof sqlText !== 'string') throw new Error(`migration ${tag} is missing from the build`);
    return {
      tag,
      when,
      hash: createHash('sha256').update(sqlText).digest('hex'),
      statements: sqlText.split(STATEMENT_BREAKPOINT),
    };
  }));
};

export const migrateStore = async (store: Store) => {
  const migrations = await readMigrations();
  store.run(sql.raw(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`));
  const [lastApplied] = store.all<{ created_at: number }>(sql.raw(`SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`));
  const pending = migrations.filter(migration => !lastApplied || Number(lastApplied.created_at) < migration.when);
  store.transaction((tx) => {
    for (const migration of pending) {
      for (const statement of migration.statements) tx.run(sql.raw(statement));
      tx.run(sql.raw(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES ('${migration.hash}', ${migration.when})`));
    }
  });
  return pending.map(migration => migration.tag);
};
