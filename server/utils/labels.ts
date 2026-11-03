import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { issueLabels, labelGroupMembers, labelGroups } from '../db/schema';
import type { FieldWrite } from './changes';
import type { Principal } from './principal';
import type { Store } from './store';

export const labelsOf = (issue: number): string[] =>
  useStore().select({ label: issueLabels.label }).from(issueLabels).where(eq(issueLabels.issue, issue)).orderBy(asc(issueLabels.label)).all()
    .map(row => row.label);

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

export const addLabel = (number: number, label: string, principal: Principal) => {
  requireIssue(number);
  const stamp = stampFor(principal);
  useStore().transaction((tx) => {
    const writes = applyLabel(tx, number, label);
    if (writes.length === 0) return;
    logChanges(tx, { ...stamp, issue: number }, writes);
    touchIssue(tx, number, stamp.at);
  });
};

export const removeLabel = (number: number, label: string, principal: Principal) => {
  requireIssue(number);
  const stamp = stampFor(principal);
  useStore().transaction((tx) => {
    const { changes: removed } = tx.delete(issueLabels).where(labelOn(number, label)).run();
    if (removed === 0) return;
    logChanges(tx, { ...stamp, issue: number }, [{ field: 'label', before: label, after: null }]);
    touchIssue(tx, number, stamp.at);
  });
};
