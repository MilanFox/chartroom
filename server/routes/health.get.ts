import { sql } from 'drizzle-orm';

export default defineEventHandler((event) => {
  const { version } = useRuntimeConfig(event);
  try {
    useStore().get(sql`SELECT 1`);
    return { ok: true, version };
  }
  catch {
    setResponseStatus(event, 503);
    return { ok: false, version };
  }
});
