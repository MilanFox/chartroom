export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSessionStore();
  if (!session.loaded) await session.load();
  const onLogin = to.path === LOGIN_PATH;
  if (session.me && onLogin) return navigateTo(HOME_PATH);
  return session.me || onLogin ? undefined : navigateTo(LOGIN_PATH);
});
