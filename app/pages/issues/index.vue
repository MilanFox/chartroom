<template>
  <div class="workbench">
    <h1 class="workbench__title">{{ strings.workbench.title }}</h1>

    <div class="workbench__layout">
      <WorkbenchFilters />

      <div class="workbench__main">
        <WorkbenchSearch />

        <WorkbenchResults :loading="status === 'pending'" :failed="Boolean(error)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const workbench = useWorkbenchStore();
const labelGroupsStore = useLabelGroupsStore();
const holdersStore = useHoldersStore();
const { strings } = useStrings();

useHead(() => ({ title: strings.value.workbench.title }));

const [, { status, error }] = await Promise.all([
  useAsyncData('workbench-filters', async () => {
    await Promise.all([labelGroupsStore.load(), labelGroupsStore.loadFreeForm(), holdersStore.load()]);
    return true;
  }),
  useAsyncData('workbench-rows', async () => {
    workbench.readQuery(route.query);
    await workbench.load();
    return true;
  }, { watch: [() => route.query] }),
]);
</script>

<style lang="scss" scoped>
.workbench {
  &__title {
    margin: 0 0 $space-4;
  }

  &__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: $space-6;

    @include respond(sm) {
      grid-template-columns: 220px minmax(0, 1fr);
      align-items: start;
    }
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    min-width: 0;
  }
}
</style>
