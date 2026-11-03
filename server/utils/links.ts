import { and, asc, eq, gt } from 'drizzle-orm';
import { links } from '../db/schema';
import type { Principal } from './principal';

export type LinkRecord = typeof links.$inferSelect;
export type LinkRole = 'resource' | 'artifact';
export type LinkType = 'branch' | 'file' | 'preview' | 'doc' | 'external';

export const LINK_ROLES: LinkRole[] = ['resource', 'artifact'];
export const LINK_TYPES: LinkType[] = ['branch', 'file', 'preview', 'doc', 'external'];

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

export const createLink = (issue: number, input: NewLink, principal: Principal) => {
  requireIssue(issue);
  if (useStore().select().from(links).where(and(eq(links.issue, issue), eq(links.url, input.url))).get()) {
    throw conflict(`issue #${issue} already links ${input.url}`, 'url');
  }
  const { actor, origin, at } = stampFor(principal);
  return useStore().transaction((tx) => {
    const { id } = tx.insert(links).values({ ...input, issue, addedBy: actor, origin, createdAt: at }).returning({ id: links.id }).get();
    touchIssue(tx, issue, at);
    return tx.select().from(links).where(eq(links.id, id)).get()!;
  });
};

const requireLink = ({ issue, id }: LinkRef) => {
  requireIssue(issue);
  const link = useStore().select().from(links).where(and(eq(links.id, id), eq(links.issue, issue))).get();
  if (!link) throw notFound(`link ${id} does not exist on issue #${issue}`);
  return link;
};

export const patchLink = (ref: LinkRef, fields: LinkFields, principal: Principal) => {
  const link = requireLink(ref);
  const values = Object.fromEntries(Object.entries(fields).filter(([field, value]) => value !== undefined && value !== link[field as keyof LinkFields]));
  if (Object.keys(values).length === 0) return link;
  const { at } = stampFor(principal);
  return useStore().transaction((tx) => {
    tx.update(links).set(values).where(eq(links.id, ref.id)).run();
    touchIssue(tx, ref.issue, at);
    return tx.select().from(links).where(eq(links.id, ref.id)).get()!;
  });
};

export const deleteLink = (ref: LinkRef, principal: Principal) => {
  const link = requireLink(ref);
  const stamp = stampFor(principal);
  useStore().transaction((tx) => {
    tx.delete(links).where(eq(links.id, ref.id)).run();
    logChanges(tx, { ...stamp, issue: ref.issue }, [{ field: 'link', before: JSON.stringify({ id: link.id, title: link.title, url: link.url }), after: null }]);
    touchIssue(tx, ref.issue, stamp.at);
  });
};
