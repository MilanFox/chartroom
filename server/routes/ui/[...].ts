import { createMount } from '../../http/mount';
import { authRoutes } from '../../http/ui/auth';
import { effortAdminRoutes } from '../../http/ui/efforts';
import { holderAdminRoutes } from '../../http/ui/holders';
import { instanceAdminRoutes } from '../../http/ui/instance';
import { labelGroupAdminRoutes } from '../../http/ui/label-groups';
import { snapshotAdminRoutes } from '../../http/ui/snapshots';

export default createMount({
  origin: 'ui',
  resolveCaller: resolveSessionCaller,
  extraRoutes: [...authRoutes, ...holderAdminRoutes, ...instanceAdminRoutes, ...labelGroupAdminRoutes, ...effortAdminRoutes, ...snapshotAdminRoutes],
});
