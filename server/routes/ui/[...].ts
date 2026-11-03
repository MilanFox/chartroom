import { createMount } from '../../http/mount';
import { authRoutes } from '../../http/ui/auth';
import { holderAdminRoutes } from '../../http/ui/holders';

export default createMount({
  origin: 'ui',
  resolvePrincipal: resolveSessionPrincipal,
  extraRoutes: [...authRoutes, ...holderAdminRoutes],
});
