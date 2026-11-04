import { asc, count, eq } from 'drizzle-orm';
import { instanceSettings, issues, labelGroupMembers } from '../db/schema';

const SETTINGS_ROW = 1;
const DEFAULT_PROJECT_NAME = 'Chartroom';
const DEFAULT_EFFORT_NAME = 'Effort';

const storedSettings = () => useStore().select().from(instanceSettings).where(eq(instanceSettings.id, SETTINGS_ROW)).get() ?? null;

export const triageLabels = () => Object.fromEntries(
  useStore().select({ id: labelGroupMembers.id, displayLabel: labelGroupMembers.displayLabel }).from(labelGroupMembers)
    .where(eq(labelGroupMembers.groupId, 'triage-state')).orderBy(asc(labelGroupMembers.position)).all()
    .map(({ id, displayLabel }) => [id, displayLabel]),
);

export const instanceSettingsOf = () => {
  const stored = storedSettings();
  const singular = stored?.effortSingular ?? DEFAULT_EFFORT_NAME;
  return {
    projectName: stored?.projectName ?? DEFAULT_PROJECT_NAME,
    effortName: { singular, plural: stored?.effortPlural ?? `${singular}s` },
    triageLabels: triageLabels(),
  };
};

export const openIssueCount = () =>
  useStore().select({ open: count() }).from(issues).where(eq(issues.state, 'open')).get()!.open;

export interface SettingsPatch {
  projectName?: string
  effortName?: { singular: string, plural: string | null }
  triageLabels?: Record<string, string>
}

export const writeInstanceSettings = (patch: SettingsPatch, actor: string) => {
  const current = storedSettings();
  const row = {
    id: SETTINGS_ROW,
    projectName: patch.projectName ?? current?.projectName ?? DEFAULT_PROJECT_NAME,
    effortSingular: patch.effortName?.singular ?? current?.effortSingular ?? DEFAULT_EFFORT_NAME,
    effortPlural: patch.effortName ? patch.effortName.plural : current?.effortPlural ?? null,
    updatedAt: nowIso(),
    updatedBy: actor,
  };
  useStore().transaction((tx) => {
    tx.insert(instanceSettings).values(row).onConflictDoUpdate({ target: instanceSettings.id, set: row }).run();
    for (const [id, displayLabel] of Object.entries(patch.triageLabels ?? {})) {
      tx.update(labelGroupMembers).set({ displayLabel }).where(eq(labelGroupMembers.id, id)).run();
    }
  });
  return { ...instanceSettingsOf(), updatedAt: row.updatedAt, updatedBy: row.updatedBy };
};
