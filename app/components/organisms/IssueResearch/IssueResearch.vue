<template>
  <FieldRow v-if="notes.length" :heading="strings.issue.fields.research.heading">
    <ul class="issue-research__list">
      <li v-for="note in notes" :key="note.slug" class="issue-research__note">
        <NuxtLink :to="researchNotePath(note.issue, note.slug)" class="issue-research__title">{{ note.title }}</NuxtLink>

        <span class="issue-research__meta">{{ format(strings.issue.fields.research.meta, { size: formatFileSize(note.size), date: formatDate(note.updatedAt) }) }}</span>

        <LinkCopyButton :url="note.url" :title="note.title" />
      </li>
    </ul>
  </FieldRow>
</template>

<script setup lang="ts">
import type { IssueResearchProps } from './IssueResearch.types';

const props = defineProps<IssueResearchProps>();

const research = useResearchStore();
const { strings, format } = useStrings();

await useAsyncData(() => `issue-research-${props.issue.number}`, async () => {
  await research.loadList(props.issue.number);
  return true;
}, { watch: [() => props.issue.updatedAt] });

const notes = computed(() => research.lists[props.issue.number] ?? []);
</script>

<style lang="scss" scoped>
.issue-research {
  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1;

    &:hover,
    &:focus-within {
      --link-copy-opacity: 1;
    }
  }

  &__title {
    color: var(--color-accent);
    overflow-wrap: anywhere;
  }

  &__meta {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
