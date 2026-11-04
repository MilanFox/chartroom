import type { H3Event } from 'h3';
import type { Me } from '#shared/api';
import type { Caller } from '../../utils/caller';
import type { JsonSchema } from '../table';

export const ME_SCHEMA: JsonSchema = { type: 'object', properties: { slug: { type: ['string', 'null'] }, displayName: { type: ['string', 'null'] }, viewer: { type: 'boolean' }, admin: { type: ['object', 'null'], properties: { until: { type: 'string' } } } }, required: ['slug', 'displayName', 'viewer', 'admin'] };

export const API_ME_SCHEMA: JsonSchema = { ...ME_SCHEMA, required: ['slug', 'displayName'] };

export const uiMe = (caller: Caller): Me => ({
  slug: caller.slug,
  displayName: caller.displayName,
  viewer: caller.viewer,
  admin: isElevated(caller) ? { until: caller.adminUntil! } : null,
});

export const me = (_event: H3Event, caller: Caller): Me | Pick<Me, 'slug' | 'displayName'> =>
  caller.origin === 'ui' ? uiMe(caller) : { slug: caller.slug, displayName: caller.displayName };
