import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';
import { toEnvironment, toPointer } from '../representations';

export const canSeePointers = (principal: Principal) => !principal.viewer || isElevated(principal);

export const environmentList = (_event: H3Event, principal: Principal) => {
  const pointers = canSeePointers(principal) ? listPointers() : null;
  return listEnvironments().map(environment => toEnvironment(environment, pointers));
};

export const pointerList = (_event: H3Event, principal: Principal) => {
  if (!canSeePointers(principal)) throw forbidden('credential pointers require a holder session or elevation');
  return listPointers().map(toPointer);
};
