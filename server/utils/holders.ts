import { and, asc, eq, isNull } from 'drizzle-orm';
import { holderSecrets, holders } from '../db/schema';
import type { Store } from './store';

export type HolderRecord = typeof holders.$inferSelect;
export type SecretRecord = typeof holderSecrets.$inferSelect;

export interface NewHolder {
  slug: string
  displayName?: string | null
}

const SLUG_SHAPE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVED_SLUG = 'admin';

export const findHolder = (slug: string): HolderRecord | null =>
  useStore().select().from(holders).where(eq(holders.slug, slug)).get() ?? null;

const requireHolder = (slug: string) => {
  const holder = findHolder(slug);
  if (!holder) throw notFound(`holder ${slug} does not exist`);
  return holder;
};

const activeSecret = (slug: string) =>
  useStore().select().from(holderSecrets).where(and(eq(holderSecrets.holderSlug, slug), isNull(holderSecrets.revokedAt))).get() ?? null;

const retireSecrets = (slug: string, store: Store) => {
  store.update(holderSecrets).set({ revokedAt: nowIso() })
    .where(and(eq(holderSecrets.holderSlug, slug), isNull(holderSecrets.revokedAt))).run();
};

const issueSecretFor = (slug: string, store: Store) => {
  const secret = issueSecret(slug);
  store.insert(holderSecrets).values({ holderSlug: slug, hash: hashSecret(secret), createdAt: nowIso() }).run();
  return secret;
};

export const createHolder = ({ slug, displayName }: NewHolder, actor: string) => {
  if (!SLUG_SHAPE.test(slug)) throw invalid('slug must be lowercase letters, digits and hyphens', 'slug');
  if (slug === RESERVED_SLUG) throw invalid(`${RESERVED_SLUG} is a reserved slug`, 'slug');
  const at = nowIso();
  const secret = useStore().transaction((tx) => {
    if (findHolder(slug)) throw conflict(`holder ${slug} already exists`, 'slug');
    tx.insert(holders).values({ slug, displayName: displayName ?? null, createdAt: at, updatedAt: at, updatedBy: actor }).run();
    return issueSecretFor(slug, tx);
  });
  return { holder: requireHolder(slug), secret };
};

export const rotateHolder = (slug: string, actor: string) => {
  const holder = requireHolder(slug);
  if (holder.revokedAt) throw conflict(`holder ${slug} is revoked`);
  const secret = useStore().transaction((tx) => {
    retireSecrets(slug, tx);
    deleteSessionsForHolder(slug, tx);
    tx.update(holders).set({ updatedAt: nowIso(), updatedBy: actor }).where(eq(holders.slug, slug)).run();
    return issueSecretFor(slug, tx);
  });
  return { holder: requireHolder(slug), secret };
};

export const revokeHolder = (slug: string, actor: string) => {
  const holder = requireHolder(slug);
  if (holder.revokedAt) return holder;
  useStore().transaction((tx) => {
    retireSecrets(slug, tx);
    deleteSessionsForHolder(slug, tx);
    tx.update(holders).set({ revokedAt: nowIso(), updatedAt: nowIso(), updatedBy: actor }).where(eq(holders.slug, slug)).run();
  });
  return requireHolder(slug);
};

export const authenticateSecret = (secret: string): HolderRecord | null => {
  const slug = holderSlugOfSecret(secret);
  const holder = slug ? findHolder(slug) : null;
  if (!holder || holder.revokedAt) return null;
  const active = activeSecret(holder.slug);
  if (!active || !hashesMatch(hashSecret(secret), active.hash)) return null;
  const lastUsedAt = nowIso();
  useStore().update(holders).set({ lastUsedAt }).where(eq(holders.slug, holder.slug)).run();
  return { ...holder, lastUsedAt };
};

export const listHolders = (): HolderRecord[] => useStore().select().from(holders).orderBy(asc(holders.slug)).all();

export const secretHistoryOf = (slug: string): SecretRecord[] =>
  useStore().select().from(holderSecrets).where(eq(holderSecrets.holderSlug, slug)).orderBy(asc(holderSecrets.id)).all();
