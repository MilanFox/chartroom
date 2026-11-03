import type { H3Event } from 'h3';
import type { Principal } from '../utils/principal';
import { holderRoster } from './handlers/holders';
import { me } from './handlers/me';

export type RouteMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
export type Handler<Args extends unknown[], Result = unknown> = (...args: Args) => Result;

export interface TableRoute {
  method: RouteMethod
  path: string
  handler: Handler<[H3Event, Principal]>
}

export const routeTable: TableRoute[] = [
  { method: 'get', path: '/me', handler: me },
  { method: 'get', path: '/holders', handler: holderRoster },
];
