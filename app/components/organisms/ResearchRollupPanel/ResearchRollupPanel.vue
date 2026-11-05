<template>
  <DisclosureSection :heading="strings.dashboard.research.heading" :meta="format(strings.dashboard.research.count, { count: effort.researchRollup.length })">
    <ul v-if="effort.researchRollup.length" class="research-rollup__list">
      <li v-for="note in effort.researchRollup" :key="note.url" class="research-rollup__note">
        <span class="research-rollup__target">
          <NuxtLink :to="researchNotePath(note.issue.number, note.slug)" class="research-rollup__title">{{ note.title }}</NuxtLink>

          <span class="research-rollup__meta">
            <span v-if="fromPrefix">{{ fromPrefix }}</span>

            <NuxtLink :to="producingPath(note.issue)" class="research-rollup__source">{{ format(strings.dashboard.research.source, { number: note.issue.number, title: note.issue.title }) }}</NuxtLink>

            <span v-if="fromSuffix">{{ fromSuffix }}</span>

            {{ strings.issue.meta.separator }}{{ format(strings.dashboard.research.updated, { date: formatDate(note.updatedAt) }) }}
          </span>
        </span>

        <LinkCopyButton :url="note.url" :title="note.title" />
      </li>
    </ul>

    <p v-else class="research-rollup__none">{{ strings.dashboard.research.none }}</p>
  </DisclosureSection>
</template>

<script setup lang="ts">
import type { RolledUpResearchNote } from '~/types/api';
import type { ResearchRollupPanelProps } from './ResearchRollupPanel.types';

defineProps<ResearchRollupPanelProps>();

const { strings, format } = useStrings();

const fromParts = computed(() => strings.value.dashboard.research.from.split('{issue}'));
const fromPrefix = computed(() => fromParts.value[0]);
const fromSuffix = computed(() => fromParts.value[1]);

const producingPath = (issue: RolledUpResearchNote['issue']) => (issue.kind === 'effort' ? effortPath(issue) : issuePath(issue.number));
</script>

<style lang="scss" scoped>
.research-rollup {
  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__note {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: $space-1 $space-3;
    padding: $space-2 0;

    & + & {
      border-top: 1px dashed var(--color-rule);
    }

    &:hover,
    &:focus-within {
      --link-copy-opacity: 1;
    }
  }

  &__target {
    display: flex;
    flex: 1 1 240px;
    flex-direction: column;
    min-width: 0;
  }

  &__title {
    color: var(--color-accent);
    overflow-wrap: anywhere;
  }

  &__meta {
    color: var(--color-muted);
    font-size: $font-size-meta;
    overflow-wrap: anywhere;
  }

  &__source {
    color: inherit;
  }

  &__none {
    margin: 0;
    color: var(--color-muted);
  }
}
</style>
