import { and, eq, exists, inArray, isNull, notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { issueBlockers, issues } from '../db/schema';

const blockerIssue = alias(issues, 'blocker_issue');
const parentIssue = alias(issues, 'parent_issue');

const openBlockerExists = () =>
  useStore().select({ one: issueBlockers.issue }).from(issueBlockers)
    .innerJoin(blockerIssue, eq(blockerIssue.number, issueBlockers.blocker))
    .where(and(eq(issueBlockers.issue, issues.number), eq(blockerIssue.state, 'open')));

export const takeableCondition = () => and(eq(issues.state, 'open'), isNull(issues.assignee), notExists(openBlockerExists()))!;

const parentIsMapOrSpec = () =>
  inArray(issues.parent, useStore().select({ number: parentIssue.number }).from(parentIssue).where(inArray(parentIssue.kind, ['map', 'spec'])));

export const blockedCondition = () => and(eq(issues.state, 'open'), exists(openBlockerExists()))!;

export const frontierCondition = () => and(takeableCondition(), parentIsMapOrSpec())!;

export const frontierSizeOf = (parent: number) =>
  useStore().select({ number: issues.number }).from(issues).where(and(eq(issues.parent, parent), takeableCondition())).all().length;
