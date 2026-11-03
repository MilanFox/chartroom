import { and, asc, eq, inArray } from 'drizzle-orm';
import { issueBlockers, issues } from '../db/schema';
import type { Principal } from './principal';
import type { Store } from './store';

export interface BlockerRef {
  number: number
  title: string
  open: boolean
}

export interface BlockedIssueRef {
  number: number
  title: string
}

export const blockersByIssue = (numbers: number[]) => {
  const blockers = new Map<number, BlockerRef[]>();
  const rows = useStore().select({ issue: issueBlockers.issue, number: issues.number, title: issues.title, state: issues.state }).from(issueBlockers)
    .innerJoin(issues, eq(issues.number, issueBlockers.blocker))
    .where(inArray(issueBlockers.issue, numbers)).orderBy(asc(issues.number)).all();
  for (const { issue, number, title, state } of rows) blockers.set(issue, [...blockers.get(issue) ?? [], { number, title, open: state === 'open' }]);
  return blockers;
};

export const blockersOf = (issue: number): BlockerRef[] => blockersByIssue([issue]).get(issue) ?? [];

export const blocksOf = (blocker: number): BlockedIssueRef[] =>
  useStore().select({ number: issues.number, title: issues.title }).from(issueBlockers)
    .innerJoin(issues, eq(issues.number, issueBlockers.issue))
    .where(eq(issueBlockers.blocker, blocker)).orderBy(asc(issues.number)).all();

export const requireBlockers = (numbers: number[]) => {
  for (const number of numbers) {
    if (!findIssue(number)) throw notFound(`blocker #${number} does not exist`);
  }
};

export const insertBlockers = (tx: Store, issue: number, blockers: number[]) => {
  if (blockers.length === 0) return;
  tx.insert(issueBlockers).values([...new Set(blockers)].map(blocker => ({ issue, blocker }))).run();
};

const edgeOf = (issue: number, blocker: number) => and(eq(issueBlockers.issue, issue), eq(issueBlockers.blocker, blocker));

const transitivelyBlockedBy = (issue: number, candidate: number) => {
  const seen = new Set<number>();
  let frontier = [issue];
  while (frontier.length > 0) {
    frontier = useStore().select({ blocker: issueBlockers.blocker }).from(issueBlockers).where(inArray(issueBlockers.issue, frontier)).all()
      .map(row => row.blocker).filter(number => !seen.has(number));
    if (frontier.includes(candidate)) return true;
    frontier.forEach(number => seen.add(number));
  }
  return false;
};

export const addBlocker = (number: number, blocker: number, principal: Principal) => {
  requireIssue(number);
  requireBlockers([blocker]);
  if (number === blocker) throw invalid(`issue #${number} cannot block itself`, 'blocker');
  if (useStore().select().from(issueBlockers).where(edgeOf(number, blocker)).get()) return;
  if (transitivelyBlockedBy(blocker, number)) throw invalid(`issue #${blocker} is already blocked through #${number}; that would be a cycle`, 'blocker');
  const stamp = stampFor(principal);
  useStore().transaction((tx) => {
    insertBlockers(tx, number, [blocker]);
    logChanges(tx, { ...stamp, issue: number }, [{ field: 'blocker', before: null, after: blocker }]);
    touchIssue(tx, number, stamp.at);
  });
};

export const removeBlocker = (number: number, blocker: number, principal: Principal) => {
  requireIssue(number);
  const stamp = stampFor(principal);
  useStore().transaction((tx) => {
    const { changes: removed } = tx.delete(issueBlockers).where(edgeOf(number, blocker)).run();
    if (removed === 0) return;
    logChanges(tx, { ...stamp, issue: number }, [{ field: 'blocker', before: blocker, after: null }]);
    touchIssue(tx, number, stamp.at);
  });
};
