import { createMount } from '../../../http/mount';

export default createMount({ origin: 'api', resolveCaller: resolveBearerCaller });
