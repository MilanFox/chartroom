import { and, asc, count, eq, gt, max } from 'drizzle-orm';
import { issueLabels, labelGroupMembers, labelGroups } from '../db/schema';
import type { Store } from './store';

export interface NewGroupMember {
  id: string
  displayLabel: string | null
}

export interface NewLabelGroup {
  id: string
  displayName: string | null
  labels: NewGroupMember[]
}

const RESERVED_GROUP_IDS = ['number', 'title', 'state', 'updated', 'updatedAt', 'createdAt', 'kind', 'label', 'assignee', 'parent', 'effort'];
const REORDER_ROUTE_SEGMENT = 'order';
const CLASH_LISTING_LIMIT = 20;

const requireSlug = (id: string, field: string) => {
  if (!LOWERCASE_SLUG_SHAPE.test(id)) throw invalid(`${id} must be a lowercase slug`, field);
  if (id === REORDER_ROUTE_SEGMENT) throw invalid(`${id} is reserved by the reorder route`, field);
};

const requireFreeMemberId = (id: string, field: string) => {
  requireSlug(id, field);
  const taken = useStore().select({ groupId: labelGroupMembers.groupId }).from(labelGroupMembers).where(eq(labelGroupMembers.id, id)).get();
  if (taken) throw invalid(`${id} is already a member of ${taken.groupId}`, field);
};

const requireAdminGroup = (id: string) => {
  const group = findLabelGroup(id);
  if (!group) throw notFound(`label group ${id} does not exist`);
  if (group.seeded) throw invalid(`${id} is a seeded label group and cannot be changed here`, 'id');
  return group;
};

const memberOfGroup = (groupId: string, id: string) => and(eq(labelGroupMembers.groupId, groupId), eq(labelGroupMembers.id, id));

const requireMember = (groupId: string, id: string) => {
  if (!useStore().select().from(labelGroupMembers).where(memberOfGroup(groupId, id)).get()) throw notFound(`${id} is not a member of ${groupId}`);
};

const requirePermutation = (given: string[], current: string[], field: string) => {
  const sameSet = new Set(given).size === given.length && given.length === current.length && given.every(id => current.includes(id));
  if (!sameSet) throw invalid(`${field} must list exactly ${current.join(', ')} once each`, field);
};

const refuseMemberClash = (tx: Store, groupId: string) => {
  const clashing = tx.select({ issue: issueLabels.issue }).from(issueLabels)
    .innerJoin(labelGroupMembers, eq(labelGroupMembers.id, issueLabels.label))
    .where(eq(labelGroupMembers.groupId, groupId))
    .groupBy(issueLabels.issue).having(gt(count(), 1)).orderBy(asc(issueLabels.issue)).limit(CLASH_LISTING_LIMIT + 1).all();
  if (clashing.length === 0) return;
  const truncated = clashing.length > CLASH_LISTING_LIMIT;
  const issues = clashing.slice(0, CLASH_LISTING_LIMIT).map(({ issue }) => issue);
  throw conflict(`${issues.map(issue => `#${issue}`).join(', ')} would carry two members of ${groupId}`, 'labels', { group: groupId, issues, truncated });
};

const nextGroupPosition = () =>
  (useStore().select({ last: max(labelGroups.position) }).from(labelGroups).where(eq(labelGroups.seeded, false)).get()?.last ?? -1) + 1;

const nextMemberPosition = (groupId: string) =>
  (useStore().select({ last: max(labelGroupMembers.position) }).from(labelGroupMembers).where(eq(labelGroupMembers.groupId, groupId)).get()?.last ?? -1) + 1;

const memberIdsOf = (groupId: string) =>
  useStore().select({ id: labelGroupMembers.id }).from(labelGroupMembers)
    .where(eq(labelGroupMembers.groupId, groupId)).orderBy(asc(labelGroupMembers.position)).all().map(member => member.id);

const touchGroup = (tx: Store, groupId: string, actor: string) => tx.update(labelGroups).set(stamp(actor)).where(eq(labelGroups.id, groupId)).run();

const adminLabelGroup = (id: string) => {
  const { updatedAt, updatedBy } = findLabelGroup(id)!;
  return { ...listLabelGroups().find(group => group.id === id)!, updatedAt, updatedBy };
};

export const createLabelGroup = ({ id, displayName, labels }: NewLabelGroup, actor: string) => {
  requireSlug(id, 'id');
  if (RESERVED_GROUP_IDS.includes(id)) throw invalid(`${id} is a built-in sort or filter key`, 'id');
  if (findLabelGroup(id)) throw conflict(`label group ${id} already exists`, 'id');
  for (const member of labels) requireFreeMemberId(member.id, 'labels');
  if (new Set(labels.map(member => member.id)).size < labels.length) throw invalid('labels must not repeat a member id', 'labels');
  useStore().transaction((tx) => {
    tx.insert(labelGroups).values({ id, displayName: displayName ?? id, position: nextGroupPosition(), ...stamp(actor) }).run();
    labels.forEach((member, position) => {
      tx.insert(labelGroupMembers).values({ id: member.id, groupId: id, displayLabel: member.displayLabel ?? member.id, position }).run();
    });
    refuseMemberClash(tx, id);
  });
  return adminLabelGroup(id);
};

export const renameLabelGroup = (id: string, displayName: string, actor: string) => {
  requireAdminGroup(id);
  useStore().update(labelGroups).set({ displayName, ...stamp(actor) }).where(eq(labelGroups.id, id)).run();
  return adminLabelGroup(id);
};

export const reorderLabelGroups = (order: string[], actor: string) => {
  const current = listLabelGroups().filter(group => !group.seeded).map(group => group.id);
  requirePermutation(order, current, 'groups');
  useStore().transaction((tx) => {
    order.forEach((id, position) => tx.update(labelGroups).set({ position, ...stamp(actor) }).where(eq(labelGroups.id, id)).run());
  });
  return order.map(adminLabelGroup);
};

export const deleteLabelGroup = (id: string) => {
  requireAdminGroup(id);
  useStore().delete(labelGroups).where(eq(labelGroups.id, id)).run();
};

export const addGroupMember = (groupId: string, member: NewGroupMember, actor: string) => {
  requireAdminGroup(groupId);
  requireFreeMemberId(member.id, 'id');
  useStore().transaction((tx) => {
    tx.insert(labelGroupMembers).values({ id: member.id, groupId, displayLabel: member.displayLabel ?? member.id, position: nextMemberPosition(groupId) }).run();
    refuseMemberClash(tx, groupId);
    touchGroup(tx, groupId, actor);
  });
  return adminLabelGroup(groupId);
};

export const renameGroupMember = (groupId: string, { id, displayLabel }: { id: string, displayLabel: string }, actor: string) => {
  requireAdminGroup(groupId);
  requireMember(groupId, id);
  useStore().transaction((tx) => {
    tx.update(labelGroupMembers).set({ displayLabel }).where(memberOfGroup(groupId, id)).run();
    touchGroup(tx, groupId, actor);
  });
  return adminLabelGroup(groupId);
};

export const reorderGroupMembers = (groupId: string, order: string[], actor: string) => {
  requireAdminGroup(groupId);
  requirePermutation(order, memberIdsOf(groupId), 'labels');
  useStore().transaction((tx) => {
    order.forEach((id, position) => tx.update(labelGroupMembers).set({ position }).where(eq(labelGroupMembers.id, id)).run());
    touchGroup(tx, groupId, actor);
  });
  return adminLabelGroup(groupId);
};

export const removeGroupMember = (groupId: string, id: string, actor: string) => {
  requireAdminGroup(groupId);
  requireMember(groupId, id);
  useStore().transaction((tx) => {
    tx.delete(labelGroupMembers).where(memberOfGroup(groupId, id)).run();
    touchGroup(tx, groupId, actor);
  });
  return adminLabelGroup(groupId);
};
