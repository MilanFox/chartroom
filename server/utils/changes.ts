import { changes } from '../db/schema';
import type { Principal } from './principal';
import type { Store } from './store';

export type LoggedField = 'title' | 'body' | 'parent' | 'name' | 'testInstructions' | 'state' | 'assignee' | 'comment' | 'label' | 'blocker' | 'link';
export type LoggedValue = string | number | null;

export interface WriteStamp {
  actor: string
  origin: Principal['origin']
  at: string
}

export interface ChangeContext extends WriteStamp {
  issue: number
}

export interface FieldWrite {
  field: LoggedField
  before: LoggedValue
  after: LoggedValue
}

export const stampFor = (principal: Principal): WriteStamp => ({ actor: actorSlug(principal), origin: principal.origin, at: nowIso() });

const asLogged = (value: LoggedValue) => (value === null ? null : String(value));

export const logChanges = (tx: Store, context: ChangeContext, writes: FieldWrite[]) => {
  tx.insert(changes).values(writes.map(write => ({
    issue: context.issue,
    actor: context.actor,
    origin: context.origin,
    at: context.at,
    field: write.field,
    before: asLogged(write.before),
    after: asLogged(write.after),
  }))).run();
};
