export const useUpdateNotice = () => {
  const session = useSessionStore();
  const instanceStore = useInstanceStore();
  const { strings, format } = useStrings();

  return computed(() => {
    const update = instanceStore.instance?.updateAvailable;
    return session.adminUntil && update ? { label: format(strings.value.shell.updateAvailable, { version: update.version }), url: update.url } : null;
  });
};
