const FAILURE_LIMIT = 10;
const WINDOW_MS = 60_000;

const failuresByIp = new Map<string, number[]>();

const recentFailures = (ip: string) => {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = (failuresByIp.get(ip) ?? []).filter(at => at > cutoff);
  if (recent.length) failuresByIp.set(ip, recent);
  else failuresByIp.delete(ip);
  return recent;
};

export const assertNotLimited = (ip: string) => {
  if (recentFailures(ip).length >= FAILURE_LIMIT) throw rateLimited('too many failed authentication attempts, try again later');
};

export const recordAuthFailure = (ip: string) => {
  failuresByIp.set(ip, [...recentFailures(ip), Date.now()]);
};
