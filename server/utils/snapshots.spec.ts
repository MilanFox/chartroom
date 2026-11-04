import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupsDir, findSnapshot, listSnapshots, manualStem, preMigrateStem, snapshotToRestore } from './snapshots';

let dataDir: string;

const addFile = (name: string) => writeFileSync(join(backupsDir(dataDir), name), 'x');

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'chartroom-snapshots-'));
  mkdirSync(backupsDir(dataDir));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('Snapshot names', () => {
  it('parses kind and takenAt out of the file name', () => {
    addFile('manual-2026-03-04T05-06-07-089Z.sqlite');
    addFile('pre-migrate-0003-to-0.4.0-2026-03-05T05-06-07-089Z.sqlite');
    expect(listSnapshots(dataDir)).toEqual([
      { name: 'pre-migrate-0003-to-0.4.0-2026-03-05T05-06-07-089Z', kind: 'pre-migrate', takenAt: '2026-03-05T05:06:07.089Z', size: 1 },
      { name: 'manual-2026-03-04T05-06-07-089Z', kind: 'manual', takenAt: '2026-03-04T05:06:07.089Z', size: 1 },
    ]);
  });

  it('ignores files that are not Snapshots', () => {
    addFile('notes.txt');
    addFile('manual-yesterday.sqlite');
    addFile('manual-2026-03-04T05-06-07-089Z.sqlite-wal');
    expect(listSnapshots(dataDir)).toEqual([]);
  });

  it('round-trips the stems it generates', () => {
    addFile(`${manualStem()}.sqlite`);
    addFile(`${preMigrateStem('0007', '1.2.3-rc.1')}.sqlite`);
    expect(listSnapshots(dataDir).map(snapshot => snapshot.kind).sort()).toEqual(['manual', 'pre-migrate']);
  });

  it('finds a Snapshot by name', () => {
    addFile('manual-2026-03-04T05-06-07-089Z.sqlite');
    expect(findSnapshot(dataDir, 'manual-2026-03-04T05-06-07-089Z')?.kind).toBe('manual');
    expect(findSnapshot(dataDir, 'manual-2026-03-04T05-06-07-090Z')).toBeNull();
  });
});

describe('snapshotToRestore', () => {
  const oldest = 'pre-migrate-0002-to-0.3.0-2026-01-01T00-00-00-000Z';
  const newest = 'pre-migrate-0004-to-0.4.0-2026-02-01T00-00-00-000Z';

  beforeEach(() => {
    addFile(`${oldest}.sqlite`);
    addFile(`${newest}.sqlite`);
    addFile('manual-2026-03-01T00-00-00-000Z.sqlite');
  });

  it('prefers the pre-migrate Snapshot taken from exactly the image schema', () => {
    expect(snapshotToRestore(dataDir, '0002')?.name).toBe(oldest);
  });

  it('falls back to the newest pre-migrate Snapshot from an older schema', () => {
    expect(snapshotToRestore(dataDir, '0003')?.name).toBe(oldest);
  });

  it('returns null when every pre-migrate Snapshot is from a newer schema', () => {
    expect(snapshotToRestore(dataDir, '0001')).toBeNull();
  });
});
