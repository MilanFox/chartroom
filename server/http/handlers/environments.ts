import type { H3Event } from 'h3';
import type { Caller } from '../../utils/caller';
import { toEnvironment, toPointer } from '../representations';

export const canSeePointers = (caller: Caller) => !caller.viewer || isElevated(caller);

export const environmentList = (_event: H3Event, caller: Caller) => {
  const pointers = canSeePointers(caller) ? listPointers() : null;
  return { items: listEnvironments().map(environment => toEnvironment(environment, pointers)), nextCursor: null };
};

export const pointerList = (_event: H3Event, caller: Caller) => {
  if (!canSeePointers(caller)) throw forbidden('credential pointers require a holder session or elevation');
  return { items: listPointers().map(toPointer), nextCursor: null };
};
