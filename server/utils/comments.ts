import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { comments } from '../db/schema';
import type { Principal } from './principal';
import type { Store } from './store';

export type CommentRecord = typeof comments.$inferSelect;

export interface CommentQuery {
  after?: number | null
  limit: number
}

export const commentsOf = (issue: number): CommentRecord[] =>
  useStore().select().from(comments).where(eq(comments.issue, issue)).orderBy(asc(comments.id)).all();

export const resolutionOf = (issue: number): CommentRecord | null =>
  useStore().select().from(comments).where(and(eq(comments.issue, issue), eq(comments.resolution, true))).orderBy(desc(comments.id)).get() ?? null;

export const listComments = (issue: number, { after, limit }: CommentQuery): CommentRecord[] => {
  requireIssue(issue);
  const conditions = [eq(comments.issue, issue)];
  if (after !== null && after !== undefined) conditions.push(gt(comments.id, after));
  return useStore().select().from(comments).where(and(...conditions)).orderBy(asc(comments.id)).limit(limit).all();
};

export interface NewComment {
  issue: number
  body: string
  at: string
  resolution?: boolean
}

export interface CommentRef {
  issue: number
  id: number
}

export const insertComment = (tx: Store, { issue, body, at, resolution = false }: NewComment, principal: Principal) => {
  const { id } = tx.insert(comments).values({ issue, author: actorSlug(principal), body, origin: principal.origin, resolution, createdAt: at, updatedAt: at })
    .returning({ id: comments.id }).get();
  return tx.select().from(comments).where(eq(comments.id, id)).get()!;
};

export const createComment = (issue: number, body: string, principal: Principal) => {
  let comment: CommentRecord;
  recordIssueWrite(issue, principal, (tx, { at }) => {
    comment = insertComment(tx, { issue, body, at }, principal);
    return [];
  });
  return comment!;
};

const requireComment = ({ issue, id }: CommentRef) => {
  requireIssue(issue);
  const comment = useStore().select().from(comments).where(and(eq(comments.id, id), eq(comments.issue, issue))).get();
  if (!comment) throw notFound(`comment ${id} does not exist on issue #${issue}`);
  return comment;
};

const requireAuthor = (comment: CommentRecord, principal: Principal) => {
  if (comment.author !== actorSlug(principal)) throw forbidden(`only ${comment.author} may change this comment`);
};

export const patchComment = ({ issue, id }: CommentRef, body: string, principal: Principal) => {
  const comment = requireComment({ issue, id });
  requireAuthor(comment, principal);
  recordIssueWrite(issue, principal, (tx, { at }) => {
    tx.update(comments).set({ body, updatedAt: at }).where(eq(comments.id, id)).run();
    return [];
  });
  return useStore().select().from(comments).where(eq(comments.id, id)).get()!;
};

export const deleteComment = ({ issue, id }: CommentRef, principal: Principal) => {
  const comment = requireComment({ issue, id });
  requireAuthor(comment, principal);
  recordIssueWrite(issue, principal, (tx) => {
    tx.delete(comments).where(eq(comments.id, id)).run();
    return [{ field: 'comment', before: id, after: null }];
  });
};
