import { createMount } from '../../../http/mount';

export default createMount({ origin: 'api', resolvePrincipal: resolveBearerPrincipal });
