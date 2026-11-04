import type { H3Event } from 'h3';
import type { Principal } from '../../utils/principal';
import { basicHolder, fullHolder } from '../representations';

export const holderRoster = (_event: H3Event, principal: Principal) => {
  const elevated = isElevated(principal);
  if (principal.viewer && !elevated) throw forbidden('the holder roster requires a holder session or elevation');
  return listHolders().map(elevated ? fullHolder : basicHolder);
};
