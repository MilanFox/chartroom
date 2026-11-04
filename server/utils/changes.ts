import { changes } from '../db/schema';
import type { Caller } from './caller';
import type { Handler } from '../http/table';
import type { Store } from './store';
import type { ChangeField } from '#shared/domain';

export type LoggedValue = string | number | null;

export interface WriteStamp {
  actor: string
  origin: Caller['origin']
  at: string
}

export interface ChangeContext extends WriteStamp {
  issue: number
}

export interface FieldWrite {
  field: ChangeField
  before: LoggedValue
  after: LoggedValue
}

export const stampFor = (caller: Caller): WriteStamp => ({ actor: actorSlug(caller), origin: caller.origin, at: nowIso() });

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

export const recordWrites = (tx: Store, context: ChangeContext, writes: FieldWrite[]) => {
  if (writes.length > 0) logChanges(tx, context, writes);
  touchIssue(tx, context.issue, context.at);
};

export const recordIssueWrite = (number: number, caller: Caller, mutate: Handler<[Store, WriteStamp], FieldWrite[] | null>) => {
  requireIssue(number);
  const stamp = stampFor(caller);
  useStore().transaction((tx) => {
    const writes = mutate(tx, stamp);
    if (writes) recordWrites(tx, { ...stamp, issue: number }, writes);
  });
};
