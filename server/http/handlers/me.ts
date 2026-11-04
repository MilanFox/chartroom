import type { H3Event } from 'h3';
import type { Me } from '#shared/api';
import type { Principal } from '../../utils/principal';
import type { JsonSchema } from '../table';

export const ME_SCHEMA: JsonSchema = { type: 'object', properties: { slug: { type: ['string', 'null'] }, displayName: { type: ['string', 'null'] }, viewer: { type: 'boolean' }, admin: { type: ['object', 'null'], properties: { until: { type: 'string' } } } }, required: ['slug', 'displayName', 'viewer', 'admin'] };

export const API_ME_SCHEMA: JsonSchema = { ...ME_SCHEMA, required: ['slug', 'displayName'] };

export const uiMe = (principal: Principal): Me => ({
  slug: principal.slug,
  displayName: principal.displayName,
  viewer: principal.viewer,
  admin: isElevated(principal) ? { until: principal.adminUntil! } : null,
});

export const me = (_event: H3Event, principal: Principal): Me | Pick<Me, 'slug' | 'displayName'> =>
  principal.origin === 'ui' ? uiMe(principal) : { slug: principal.slug, displayName: principal.displayName };
