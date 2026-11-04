import type { H3Event } from 'h3';
import type { Caller } from '../../utils/caller';
import { toEnvironment, toPointer } from '../representations';

export const canSeePointers = (caller: Caller) => !caller.viewer || isElevated(caller);

export const environmentList = (_event: H3Event, caller: Caller) => {
  const pointers = canSeePointers(caller) ? listPointers() : null;
  return listEnvironments().map(environment => toEnvironment(environment, pointers));
};

export const pointerList = (_event: H3Event, caller: Caller) => {
  if (!canSeePointers(caller)) throw forbidden('credential pointers require a holder session or elevation');
  return listPointers().map(toPointer);
};
