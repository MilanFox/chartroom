export const useShell = () => {
  const session = useSessionStore();
  const instanceStore = useInstanceStore();
  const effortsStore = useEffortsStore();
  const { strings, format } = useStrings();

  const effortLinks = computed(() => effortsStore.efforts.map(effort => ({
    number: effort.number,
    title: effort.title,
    to: effortPath(effort),
    open: effort.statusRollup.open,
  })));

  const openIssues = computed(() => instanceStore.instance?.openIssues ?? 0);

  const updateLabel = computed(() => {
    const version = instanceStore.instance?.updateAvailable;
    return session.adminUntil && version ? format(strings.value.shell.updateAvailable, { version }) : null;
  });

  const adminSections = computed(() => ADMIN_SECTION_IDS.map(id => ({
    id,
    label: strings.value.shell.adminSections[id],
    to: adminSectionPath(id),
    chip: id === 'about' ? updateLabel.value : null,
  })));

  const elevateLink = adminSectionPath('elevate');

  const elevationLabel = computed(() => (session.adminUntil ? format(strings.value.shell.adminUntil, { time: clockTime(session.adminUntil) }) : null));

  const signedInAs = computed(() => {
    const { me } = session;
    if (!me?.slug) return strings.value.shell.viewer;
    return me.displayName ? format(strings.value.shell.holder, { name: me.displayName, slug: me.slug }) : me.slug;
  });

  const sessionLabel = computed(() => format(strings.value.shell.sessionMenu, { who: signedInAs.value }));

  const logOut = async () => {
    await session.logout();
    await navigateTo(LOGIN_PATH);
  };

  return {
    session,
    strings,
    effortLinks,
    openIssues,
    adminSections,
    elevateLink,
    elevationLabel,
    sessionLabel,
    dropElevation: session.dropElevation,
    logOut,
  };
};
