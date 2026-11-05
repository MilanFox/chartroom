<template>
  <div v-if="issue" class="issue-page">
    <Breadcrumb :crumbs="crumbs" />

    <div class="issue-page__layout">
      <IssueHeader :issue="issue" class="issue-page__header" />

      <div class="issue-page__body">
        <IssueBody :issue="issue" />

        <DependencyGraph v-if="issue.kind === 'map' || issue.kind === 'spec'" :issue="issue" class="issue-page__graph" />
      </div>

      <IssueFields :issue="issue" class="issue-page__fields" />

      <div class="issue-page__thread">
        <IssueThread :issue="issue" />

        <IssueCloseForm :issue="issue" />
      </div>
    </div>
  </div>

  <p v-else role="alert" class="issue-page__missing">{{ format(missingMessage, { number }) }}</p>
</template>

<script setup lang="ts">
const route = useRoute();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const number = computed(() => Number(route.params.number));

const [{ error }] = await Promise.all([
  useAsyncData(`issue-${number.value}`, async () => {
    await issuesStore.load(number.value);
    return true;
  }),
  useParentCandidates(),
]);

const issue = computed(() => issuesStore.documents[number.value] ?? null);

if (issue.value?.kind === 'effort') await navigateTo(effortPath(issue.value), { replace: true });

const missingMessage = computed(() => missingMessageOf(error.value, number.value, strings.value.issue));

const crumbs = computed(() => {
  if (!issue.value) return [];
  const candidateOf = (wanted: number | null) => issuesStore.parentCandidates.find(candidate => candidate.number === wanted) ?? null;
  const effort = candidateOf(issue.value.effort);
  return crumbsFor({
    page: 'issue',
    issue: issue.value,
    effort: effort ? { number: effort.number, name: null, title: effort.title } : null,
    parent: candidateOf(issue.value.parent),
  }, strings.value.breadcrumb);
});

useHead(() => ({ title: issue.value ? format(strings.value.issue.pageTitle, { number: issue.value.number, title: issue.value.title }) : undefined }));
</script>

<style lang="scss" scoped>
.issue-page {
  &__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: $space-4;

    @include respond(sm) {
      grid-template-columns: minmax(0, 1fr) $sidebar-width;
      grid-template-rows: auto auto 1fr;
      column-gap: $space-6;
    }
  }

  &__header,
  &__body,
  &__thread {
    @include respond(sm) {
      grid-column: 1;
    }
  }

  &__header {
    margin-bottom: 0;
  }

  &__fields {
    align-self: start;

    @include respond(sm) {
      grid-column: 2;
      grid-row: 1 / span 3;
    }
  }

  &__graph {
    margin-top: $space-4;
  }

  &__thread > :first-child {
    margin-top: 0;
  }

  &__missing {
    color: var(--color-muted);
  }
}
</style>
