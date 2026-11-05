<template>
  <div v-if="note && issue" class="research-note">
    <Breadcrumb :crumbs="crumbs" />

    <article class="research-note__article" :aria-labelledby="headingId">
      <header class="research-note__header">
        <h1 :id="headingId" class="research-note__title">{{ note.title }}</h1>

        <p class="research-note__meta">
          <span class="research-note__address">{{ format(strings.research.address, { number: note.issue, slug: note.slug }) }}</span>

          {{ strings.issue.meta.separator }}{{ formatFileSize(note.size) }}

          {{ strings.issue.meta.separator }}{{ format(strings.research.updated, { date: formatTimestamp(note.updatedAt), holder: note.updatedBy }) }}

          <ManualChip :origin="note.origin" />

          <LinkCopyButton :url="note.url" :title="note.title" />
        </p>
      </header>

      <div class="research-note__body">
        <MarkdownText :source="bodyBelowTitle(note.body)" :min-heading-level="2" />
      </div>
    </article>
  </div>

  <p v-else role="alert" class="research-note__missing">{{ format(missingMessage, { number, slug }) }}</p>
</template>

<script setup lang="ts">
import { researchNoteKey } from '~/stores/research';

const route = useRoute();
const issuesStore = useIssuesStore();
const research = useResearchStore();
const { strings, format } = useStrings();
const headingId = useId();
const number = computed(() => Number(route.params.number));
const slug = computed(() => String(route.params.slug));

const [{ error }] = await Promise.all([
  useAsyncData(`research-${number.value}-${slug.value}`, async () => {
    await Promise.all([research.load(number.value, slug.value), issuesStore.load(number.value)]);
    return true;
  }),
  useParentCandidates(),
]);

const note = computed(() => research.notes[researchNoteKey(number.value, slug.value)] ?? null);
const issue = computed(() => issuesStore.documents[number.value] ?? null);

const missingMessage = computed(() => missingMessageOf(error.value, number.value, strings.value.research));

const crumbs = computed(() => {
  if (!note.value || !issue.value) return [];
  const effort = issuesStore.parentCandidates.find(candidate => candidate.number === issue.value?.effort) ?? null;
  return crumbsFor({
    page: 'research',
    issue: issue.value,
    effort: effort ? { number: effort.number, name: null, title: effort.title } : null,
    note: note.value,
  }, strings.value.breadcrumb);
});

useHead(() => ({ title: note.value ? format(strings.value.research.pageTitle, { title: note.value.title, number: note.value.issue, slug: note.value.slug }) : undefined }));
</script>

<style lang="scss" scoped>
.research-note {
  min-width: 0;

  &__article {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__title {
    margin: 0;
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1;
    margin: $space-2 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
    --link-copy-opacity: 1;
  }

  &__body {
    @include card;
    min-width: 0;
    padding: $space-4;
  }

  &__missing {
    color: var(--color-muted);
  }
}
</style>
