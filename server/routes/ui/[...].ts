import { createMount } from '../../http/mount';
import { authRoutes } from '../../http/ui/auth';
import { holderAdminRoutes } from '../../http/ui/holders';
import { instanceAdminRoutes } from '../../http/ui/instance';
import { labelGroupAdminRoutes } from '../../http/ui/label-groups';

export default createMount({
  origin: 'ui',
  resolvePrincipal: resolveSessionPrincipal,
  extraRoutes: [...authRoutes, ...holderAdminRoutes, ...instanceAdminRoutes, ...labelGroupAdminRoutes],
});
