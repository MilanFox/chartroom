import { and, asc, count, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { issueLabels, issues, labelGroupMembers, labelGroups } from '../db/schema';
import type { FieldWrite } from './changes';
import type { Caller } from './caller';
import type { Store } from './store';

export const labelsByIssue = (numbers: number[]) => {
  const labels = new Map<number, string[]>();
  for (const row of useStore().select().from(issueLabels).where(inArray(issueLabels.issue, numbers)).orderBy(asc(issueLabels.label)).all()) {
    labels.set(row.issue, [...labels.get(row.issue) ?? [], row.label]);
  }
  return labels;
};

export const TRIAGE_GROUP = 'triage-state';

export const triageMemberIds = () =>
  useStore().select({ id: labelGroupMembers.id }).from(labelGroupMembers)
    .where(eq(labelGroupMembers.groupId, TRIAGE_GROUP)).orderBy(asc(labelGroupMembers.position)).all().map(row => row.id);

export const labelsOf = (issue: number): string[] => labelsByIssue([issue]).get(issue) ?? [];

export const findLabelGroup = (id: string) =>
  useStore().select().from(labelGroups).where(eq(labelGroups.id, id)).get() ?? null;

export const issuesLabelled = (label: string) =>
  useStore().select({ issue: issueLabels.issue }).from(issueLabels).where(eq(issueLabels.label, label));

export const issuesInGroup = (group: string) =>
  useStore().select({ issue: issueLabels.issue }).from(issueLabels)
    .innerJoin(labelGroupMembers, eq(labelGroupMembers.id, issueLabels.label)).where(eq(labelGroupMembers.groupId, group));

export const soleMemberPositionOnIssue = (group: string) =>
  sql<number | null>`(${useStore().select({ position: labelGroupMembers.position }).from(issueLabels)
    .innerJoin(labelGroupMembers, eq(labelGroupMembers.id, issueLabels.label))
    .where(and(eq(issueLabels.issue, issues.number), eq(labelGroupMembers.groupId, group))).limit(1)})`;

export const soleMemberPositionAmong = (group: string, labels: string[]) =>
  useStore().select({ position: labelGroupMembers.position }).from(labelGroupMembers)
    .where(and(eq(labelGroupMembers.groupId, group), inArray(labelGroupMembers.id, labels))).get()?.position ?? null;

export const listLabelGroups = () => {
  const groups = useStore().select().from(labelGroups).orderBy(desc(labelGroups.seeded), asc(labelGroups.position)).all();
  const members = useStore().select().from(labelGroupMembers).orderBy(asc(labelGroupMembers.position)).all();
  return groups.map(group => ({
    id: group.id,
    displayName: group.displayName,
    seeded: group.seeded,
    exclusive: true as const,
    labels: members.filter(member => member.groupId === group.id).map(({ id, displayLabel }) => ({ id, displayLabel })),
  }));
};

export const listFreeFormLabels = () => {
  const usage = count();
  return useStore().select({ label: issueLabels.label, count: usage }).from(issueLabels)
    .where(notInArray(issueLabels.label, useStore().select({ id: labelGroupMembers.id }).from(labelGroupMembers)))
    .groupBy(issueLabels.label).orderBy(desc(usage), asc(issueLabels.label)).all();
};

const labelOn = (issue: number, label: string) => and(eq(issueLabels.issue, issue), eq(issueLabels.label, label));

const siblingsOf = (tx: Store, issue: number, label: string): string[] => {
  const member = tx.select({ groupId: labelGroupMembers.groupId }).from(labelGroupMembers).where(eq(labelGroupMembers.id, label)).get();
  if (!member) return [];
  return tx.select({ label: issueLabels.label }).from(issueLabels)
    .innerJoin(labelGroupMembers, eq(labelGroupMembers.id, issueLabels.label))
    .where(and(eq(issueLabels.issue, issue), eq(labelGroupMembers.groupId, member.groupId), ne(issueLabels.label, label)))
    .orderBy(asc(issueLabels.label)).all().map(row => row.label);
};

export const applyLabel = (tx: Store, issue: number, label: string): FieldWrite[] => {
  if (tx.select().from(issueLabels).where(labelOn(issue, label)).get()) return [];
  const siblings = siblingsOf(tx, issue, label);
  if (siblings.length > 0) tx.delete(issueLabels).where(and(eq(issueLabels.issue, issue), inArray(issueLabels.label, siblings))).run();
  tx.insert(issueLabels).values({ issue, label }).run();
  return [...siblings.map(sibling => ({ field: 'label' as const, before: sibling, after: null })), { field: 'label', before: null, after: label }];
};

export const addLabel = (number: number, label: string, caller: Caller) =>
  recordIssueWrite(number, caller, (tx) => {
    const writes = applyLabel(tx, number, label);
    return writes.length > 0 ? writes : null;
  });

export const removeLabel = (number: number, label: string, caller: Caller) =>
  recordIssueWrite(number, caller, (tx) => {
    const { changes: removed } = tx.delete(issueLabels).where(labelOn(number, label)).run();
    return removed === 0 ? null : [{ field: 'label', before: label, after: null }];
  });
