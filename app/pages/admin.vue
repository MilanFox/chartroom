<template>
  <div class="admin">
    <AdminSectionNav :sections="sections" />

    <div class="admin__main">
      <header class="admin__header">
        <h1 class="admin__title">{{ strings.admin.heading }}</h1>

        <span v-if="elevationLabel" class="admin__elevation">{{ elevationLabel }}</span>

        <p v-else class="admin__hint">{{ strings.admin.lockedHint }}</p>
      </header>

      <div id="elevate" class="admin__elevate">
        <ElevationPrompt v-if="topPrompt && !session.adminUntil" @elevated="closeTopPrompt" @cancel="closeTopPrompt" />
      </div>

      <FirstRunChecklist v-if="showChecklist" />

      <AdminSettings />

      <AdminEnvironments />

      <AdminHolders />

      <AdminAbout />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdminSectionId } from '~/utils/paths';

const PAGE_SECTIONS: AdminSectionId[] = ['settings', 'environments', 'holders', 'about'];

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const admin = useAdminStore();
const { strings, format } = useStrings();
const topPrompt = ref(false);

await useAsyncData('admin', async () => {
  await admin.load();
  return true;
});

const showChecklist = ref(admin.firstRun === true);

const sections = computed(() => PAGE_SECTIONS.map(id => ({ id, label: strings.value.shell.adminSections[id] })));

const elevationLabel = computed(() => (session.adminUntil ? format(strings.value.shell.adminUntil, { time: clockTime(session.adminUntil) }) : null));

watch(() => session.adminUntil?.getTime() ?? null, () => admin.load());

const openTopPrompt = async () => {
  topPrompt.value = true;
  await nextTick();
  const anchor = document.getElementById('elevate');
  anchor?.scrollIntoView({ block: 'start' });
  anchor?.querySelector('input')?.focus({ preventScroll: true });
};

onMounted(() => {
  watch(() => route.hash, (hash) => {
    if (hash === '#elevate') openTopPrompt();
  }, { immediate: true });
});

const closeTopPrompt = () => {
  topPrompt.value = false;
  router.replace({ hash: '' });
};

useHead(() => ({ title: strings.value.admin.pageTitle }));
</script>

<style lang="scss" scoped>
.admin {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  @include respond(sm) {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    gap: $space-6;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    min-width: 0;
  }

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: $space-2 $space-4;
  }

  &__title {
    margin: 0;
  }

  &__elevation {
    @include elevation-chip;
  }

  &__hint {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__elevate {
    scroll-margin-top: $bar-height + $space-4;

    &:empty {
      display: none;
    }
  }
}
</style>
