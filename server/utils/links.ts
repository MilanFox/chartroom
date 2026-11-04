import { and, asc, eq, gt } from 'drizzle-orm';
import { links } from '../db/schema';
import type { Caller } from './caller';
import type { LinkRole, LinkType } from '#shared/domain';

export type LinkRecord = typeof links.$inferSelect;

export type { LinkRole, LinkType };
export { LINK_ROLES, LINK_TYPES } from '#shared/domain';

export interface LinkQuery {
  after?: number | null
  limit: number
}

export interface NewLink {
  role: LinkRole
  type: LinkType
  url: string
  title: string
}

export interface LinkFields {
  role?: LinkRole
  type?: LinkType
  title?: string
}

export interface LinkRef {
  issue: number
  id: number
}

export const linksOf = (issue: number): LinkRecord[] =>
  useStore().select().from(links).where(eq(links.issue, issue)).orderBy(asc(links.id)).all();

export const listLinks = (issue: number, { after, limit }: LinkQuery): LinkRecord[] => {
  requireIssue(issue);
  const conditions = [eq(links.issue, issue)];
  if (after !== null && after !== undefined) conditions.push(gt(links.id, after));
  return useStore().select().from(links).where(and(...conditions)).orderBy(asc(links.id)).limit(limit).all();
};

export const createLink = (issue: number, input: NewLink, caller: Caller) => {
  requireIssue(issue);
  if (useStore().select().from(links).where(and(eq(links.issue, issue), eq(links.url, input.url))).get()) {
    throw conflict(`issue #${issue} already links ${input.url}`, 'url');
  }
  let createdId = 0;
  recordIssueWrite(issue, caller, (tx, { actor, origin, at }) => {
    const { id } = tx.insert(links).values({ ...input, issue, addedBy: actor, origin, createdAt: at }).returning({ id: links.id }).get();
    createdId = id;
    return [{ field: 'link', before: null, after: loggedLink({ id, ...input }) }];
  });
  return useStore().select().from(links).where(eq(links.id, createdId)).get()!;
};

const loggedLink = ({ id, title, url }: { id: number, title: string, url: string }) => JSON.stringify({ id, title, url });

const requireLink = ({ issue, id }: LinkRef) => {
  requireIssue(issue);
  const link = useStore().select().from(links).where(and(eq(links.id, id), eq(links.issue, issue))).get();
  if (!link) throw notFound(`link ${id} does not exist on issue #${issue}`);
  return link;
};

export const patchLink = (ref: LinkRef, fields: LinkFields, caller: Caller) => {
  const link = requireLink(ref);
  const values = Object.fromEntries(Object.entries(fields).filter(([field, value]) => value !== undefined && value !== link[field as keyof LinkFields]));
  if (Object.keys(values).length === 0) return link;
  recordIssueWrite(ref.issue, caller, (tx) => {
    tx.update(links).set(values).where(eq(links.id, ref.id)).run();
    return [];
  });
  return useStore().select().from(links).where(eq(links.id, ref.id)).get()!;
};

export const deleteLink = (ref: LinkRef, caller: Caller) => {
  const link = requireLink(ref);
  recordIssueWrite(ref.issue, caller, (tx) => {
    tx.delete(links).where(eq(links.id, ref.id)).run();
    return [{ field: 'link', before: loggedLink(link), after: null }];
  });
};
