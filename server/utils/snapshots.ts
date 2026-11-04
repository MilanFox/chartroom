import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import type { Store } from './store';

export type SnapshotKind = 'pre-migrate' | 'manual';

export interface Snapshot {
  name: string
  kind: SnapshotKind
  takenAt: string
  size: number
}

const SNAPSHOT_FILE_NAME = /^(?<kind>pre-migrate-(?<oldSchema>\d{4})-to-.+|manual)-(?<date>\d{4}-\d{2}-\d{2})T(?<hours>\d{2})-(?<minutes>\d{2})-(?<seconds>\d{2})-(?<millis>\d{3})Z\.sqlite$/;

export const snapshotsDir = (dataDir: string) => join(dataDir, 'backups');

export const snapshotFile = (dataDir: string, name: string) => join(snapshotsDir(dataDir), `${name}.sqlite`);

const stampOf = (at: Date) => at.toISOString().replace(/[:.]/g, '-');

export const preMigrateStem = (lastAppliedIndex: string, newVersion: string) => `pre-migrate-${lastAppliedIndex}-to-${newVersion}-${stampOf(new Date())}`;

export const manualStem = () => `manual-${stampOf(new Date())}`;

const describeSnapshot = (dataDir: string, fileName: string): Snapshot | null => {
  const match = SNAPSHOT_FILE_NAME.exec(fileName);
  if (!match?.groups) return null;
  const { kind, date, hours, minutes, seconds, millis } = match.groups;
  return {
    name: fileName.slice(0, -'.sqlite'.length),
    kind: kind === 'manual' ? 'manual' : 'pre-migrate',
    takenAt: `${date}T${hours}:${minutes}:${seconds}.${millis}Z`,
    size: statSync(join(snapshotsDir(dataDir), fileName)).size,
  };
};

export const listSnapshots = (dataDir: string) => readdirSync(snapshotsDir(dataDir))
  .map(fileName => describeSnapshot(dataDir, fileName))
  .filter(snapshot => snapshot !== null)
  .sort((first, second) => second.takenAt.localeCompare(first.takenAt));

const oldSchemaOf = (snapshot: Snapshot) => SNAPSHOT_FILE_NAME.exec(`${snapshot.name}.sqlite`)?.groups?.oldSchema ?? '';

export const snapshotToRestore = (dataDir: string, imageIndex: string) => {
  const preMigrate = listSnapshots(dataDir).filter(snapshot => snapshot.kind === 'pre-migrate');
  return preMigrate.find(snapshot => oldSchemaOf(snapshot) === imageIndex) ?? preMigrate.find(snapshot => oldSchemaOf(snapshot) <= imageIndex) ?? null;
};

export const readSnapshot = (dataDir: string, name: string) => readFileSync(snapshotFile(dataDir, name));

export const findSnapshot = (dataDir: string, name: string) => listSnapshots(dataDir).find(snapshot => snapshot.name === name) ?? null;

const assertIntact = (file: string) => {
  const copy = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const result = copy.pragma('quick_check', { simple: true });
    if (result !== 'ok') throw new Error(`quick_check reported ${String(result)}`);
  }
  finally {
    copy.close();
  }
};

export const takeSnapshot = (store: Store, dataDir: string, stem: string) => {
  const file = snapshotFile(dataDir, stem);
  if (existsSync(file)) throw new Error(`${stem} already exists`);
  try {
    store.run(sql`VACUUM INTO ${file}`);
    assertIntact(file);
  }
  catch (error) {
    rmSync(file, { force: true });
    throw error;
  }
  return describeSnapshot(dataDir, `${stem}.sqlite`)!;
};

export const deleteSnapshot = (dataDir: string, name: string) => {
  if (findSnapshot(dataDir, name)?.kind === 'pre-migrate') throw invalid('a pre-migrate Snapshot cannot be deleted', 'name');
  rmSync(snapshotFile(dataDir, name));
};
