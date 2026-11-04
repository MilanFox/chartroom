import type { H3Event } from 'h3';
import type { Caller } from '../../utils/caller';
import { basicHolder, fullHolder } from '../representations';

export const holderRoster = (_event: H3Event, caller: Caller) => {
  const elevated = isElevated(caller);
  if (caller.viewer && !elevated) throw forbidden('the holder roster requires a holder session or elevation');
  return listHolders().map(elevated ? fullHolder : basicHolder);
};
