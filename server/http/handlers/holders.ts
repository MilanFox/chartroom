import type { H3Event } from 'h3';
import type { HolderRecord } from '../../utils/holders';
import type { Principal } from '../../utils/principal';

export const basicHolder = (holder: HolderRecord) => ({
  slug: holder.slug,
  displayName: holder.displayName,
  revoked: holder.revokedAt !== null,
});

export const fullHolder = (holder: HolderRecord) => ({
  ...basicHolder(holder),
  createdAt: holder.createdAt,
  revokedAt: holder.revokedAt,
  lastUsedAt: holder.lastUsedAt,
  updatedAt: holder.updatedAt,
  updatedBy: holder.updatedBy,
  secretHistory: secretHistoryOf(holder.slug).map(({ hash, createdAt, revokedAt }) => ({ hash, createdAt, revokedAt })),
});

export const holderRoster = (_event: H3Event, principal: Principal) => {
  const elevated = isElevated(principal);
  if (principal.viewer && !elevated) throw forbidden('the holder roster requires a holder session or elevation');
  return listHolders().map(elevated ? fullHolder : basicHolder);
};
