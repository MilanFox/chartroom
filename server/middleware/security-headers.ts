const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': 'frame-ancestors \'none\'',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineEventHandler((event) => {
  setResponseHeaders(event, SECURITY_HEADERS);
  if (isSecureRequest(event)) setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000');
  if (/^\/(?:api|ui)\//.test(event.path)) setResponseHeader(event, 'Cache-Control', 'no-store');
});
