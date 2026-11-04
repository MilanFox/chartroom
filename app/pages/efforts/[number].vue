<template>
  <div v-if="effort" class="dashboard">
    <Breadcrumb :crumbs="crumbs" />

    <EffortHeader :effort="effort" :open-children="dashboard.openChildren" />

    <IssueBody :issue="effort" />

    <EffortTiles :effort="effort" :rows="dashboard.rows" />

    <section v-if="effort.map" class="dashboard__section" :aria-labelledby="mapHeadingId">
      <h2 :id="mapHeadingId" class="dashboard__heading">{{ strings.dashboard.map.heading }}</h2>

      <MapCard
        :key="effort.map.number"
        :map="effort.map"
        :frontier="effort.statusRollup.map?.frontier ?? 0"
        :body="dashboard.parentBodies[effort.map.number] ?? ''"
        :rows="dashboard.rows"
        @open="openDrawer"
      />
    </section>

    <section v-if="effort.specs.length" class="dashboard__section" :aria-labelledby="specsHeadingId">
      <h2 :id="specsHeadingId" class="dashboard__heading">{{ strings.dashboard.specs.heading }}</h2>

      <SpecCard
        v-for="spec in effort.specs"
        :key="spec.number"
        :spec="spec"
        :counts="specCountsOf(spec.number)"
        :body="dashboard.parentBodies[spec.number] ?? ''"
        :artifacts="artifactCountOf(spec.number, effort.linkRollup, dashboard.rows)"
        @open="openDrawer"
      />
    </section>

    <DashboardTickets :effort="effort" :rows="dashboard.rows" @open="openDrawer" />

    <div class="dashboard__panels">
      <LinkRollupPanel :effort="effort" :rows="dashboard.rows" />

      <EffortTestInstructions :effort="effort" />

      <EffortEnvironments />

      <EffortChanges :effort="effort" />
    </div>

    <IssueDrawer :number="drawerNumber" @close="drawerNumber = null" />
  </div>

  <p v-else role="alert" class="dashboard__missing">{{ format(missingMessage, { number }) }}</p>
</template>

<script setup lang="ts">
const route = useRoute();
const dashboard = useDashboardStore();
const environmentsStore = useEnvironmentsStore();
const issuesStore = useIssuesStore();
const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
const number = computed(() => Number(route.params.number));
const mapHeadingId = useId();
const specsHeadingId = useId();
const drawerNumber = ref<number | null>(null);

const [{ error }] = await Promise.all([
  useAsyncData(`effort-${number.value}`, async () => {
    await dashboard.load(number.value);
    return true;
  }),
  useAsyncData('dashboard-environments', async () => {
    await environmentsStore.load();
    return true;
  }),
  useAsyncData('label-groups', async () => {
    await labelGroupsStore.load();
    return true;
  }),
]);

const effort = computed(() => (dashboard.effort?.number === number.value ? dashboard.effort : null));

if (apiErrorCode(error.value) === 'invalid' && Number.isInteger(number.value)) await navigateTo(issuePath(number.value), { replace: true });

const missingMessage = computed(() => (apiErrorCode(error.value) === 'not-found' || !Number.isInteger(number.value) ? strings.value.dashboard.notFound : strings.value.dashboard.loadFailed));

const crumbs = computed(() => (effort.value ? crumbsFor({ page: 'dashboard', effort: effort.value }, strings.value.breadcrumb) : []));

const specCountsOf = (spec: number) => ({ ...EMPTY_STATUS_COUNTS, ...effort.value?.statusRollup.specs.find(entry => entry.number === spec)?.tickets });

const openDrawer = (issue: number) => drawerNumber.value = issue;

watch(() => issuesStore.revision, () => dashboard.refresh());

useHead(() => ({ title: effort.value ? format(strings.value.issue.pageTitle, { number: effort.value.number, title: effort.value.title }) : undefined }));
</script>

<style lang="scss" scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: $space-6;

  & > :first-child {
    margin-bottom: -$space-4;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__heading {
    margin: 0;
    font-size: $font-size-h2;
  }

  &__panels {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__missing {
    color: var(--color-muted);
  }
}
</style>
