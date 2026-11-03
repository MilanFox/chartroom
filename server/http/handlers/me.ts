import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';

export const uiMe = (principal: Principal) => ({
  slug: principal.slug,
  displayName: principal.displayName,
  viewer: principal.viewer,
  admin: isElevated(principal) ? { until: principal.adminUntil } : null,
});

export const me = (_event: H3Event, principal: Principal) =>
  principal.origin === 'ui' ? uiMe(principal) : { slug: principal.slug, displayName: principal.displayName };
