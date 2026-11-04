<template>
  <div class="shell">
    <a href="#main" class="shell__skip">{{ strings.shell.skipToContent }}</a>

    <TopBar />

    <main id="main" class="shell__content" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const session = useSessionStore();
const instanceStore = useInstanceStore();
const effortsStore = useEffortsStore();
const { strings, format } = useStrings();

await useAsyncData('shell', async () => {
  await Promise.all([instanceStore.load(), effortsStore.load()]);
  return true;
});

watch(() => Boolean(session.adminUntil), (elevated) => {
  if (elevated) instanceStore.refreshUpdateNotice();
});

useHead(() => ({
  titleTemplate: (title?: string) => (title ? format(strings.value.shell.pageTitle, { title }) : strings.value.names.project),
}));
</script>

<style lang="scss" scoped>
.shell {
  &__skip {
    @include visually-hidden;

    &:focus {
      position: fixed;
      top: $space-2;
      left: $space-2;
      z-index: 30;
      width: auto;
      height: auto;
      margin: 0;
      padding: $space-2 $space-3;
      clip-path: none;
      border-radius: $radius-control;
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }

  &__content {
    max-width: $content-width;
    margin: 0 auto;
    padding: $space-4;
    outline: none;

    @include respond(sm) {
      padding: $space-6;
    }
  }
}
</style>
