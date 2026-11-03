import { and, eq, isNull, notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { issueBlockers, issues } from '../db/schema';

const blockerIssue = alias(issues, 'blocker_issue');

const openBlockerExists = () =>
  useStore().select({ one: issueBlockers.issue }).from(issueBlockers)
    .innerJoin(blockerIssue, eq(blockerIssue.number, issueBlockers.blocker))
    .where(and(eq(issueBlockers.issue, issues.number), eq(blockerIssue.state, 'open')));

export const frontierCondition = () => and(eq(issues.state, 'open'), isNull(issues.assignee), notExists(openBlockerExists()))!;

export const frontierSizeOf = (map: number) =>
  useStore().select({ number: issues.number }).from(issues).where(and(eq(issues.parent, map), frontierCondition())).all().length;
