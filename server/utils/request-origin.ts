import type { H3Event } from 'h3';

export const clientIp = (event: H3Event) =>
  getRequestIP(event, { xForwardedFor: useDeploymentConfig().trustProxy }) ?? 'unknown';

export const isSecureRequest = (event: H3Event) =>
  getRequestProtocol(event, { xForwardedProto: useDeploymentConfig().trustProxy }) === 'https';

export const baseUrl = (event: H3Event) => {
  const config = useDeploymentConfig();
  if (config.baseUrl) return config.baseUrl.replace(/\/+$/, '');
  return getRequestURL(event, { xForwardedHost: config.trustProxy, xForwardedProto: config.trustProxy }).origin;
};
