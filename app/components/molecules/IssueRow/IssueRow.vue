<template>
  <div class="issue-row">
    <span class="issue-row__number">{{ format(strings.workbench.number, { number: row.number }) }}</span>

    <span class="issue-row__kind">{{ strings.issue.kinds[row.kind] }}</span>

    <span v-if="wayfinderType" class="issue-row__type">{{ labelGroupsStore.displayLabelOf(wayfinderType) }}</span>

    <NuxtLink :to="row.kind === 'effort' ? effortPath(row) : issuePath(row.number)" class="issue-row__title">{{ row.title }}</NuxtLink>

    <span class="issue-row__meta">
      <span v-for="label in columnLabels" :key="label" class="issue-row__label">{{ labelGroupsStore.displayLabelOf(label) }}</span>

      <span v-if="row.assignee" class="issue-row__assignee">{{ format(strings.workbench.holder, { slug: row.assignee }) }}</span>

      <StatePill :status="row.status" />

      <span v-if="effortTitle" class="issue-row__effort">{{ effortTitle }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { IssueRowProps } from './IssueRow.types';

const props = defineProps<IssueRowProps>();

const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();

const wayfinderType = computed(() => wayfinderTypeOf(props.row.labels));
const columnLabels = computed(() => props.row.labels.filter(label => label !== wayfinderType.value));
</script>

<style lang="scss" scoped>
.issue-row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-1 $space-2;
  padding: $space-2 $space-3;

  &:hover {
    background: var(--color-surface-alt);
  }

  &__number {
    min-width: 48px;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  &__kind {
    @include kind-chip;
  }

  &__title {
    flex: 1 1 240px;
    min-width: 0;
    color: var(--color-fg);
    font-weight: 500;
    text-decoration: none;

    &::after {
      position: absolute;
      inset: 0;
      content: '';
    }

    &:hover {
      color: var(--color-accent);
      text-decoration: underline;
    }

    &:focus-visible {
      outline: none;

      &::after {
        outline: 2px solid var(--color-accent);
        outline-offset: -2px;
        border-radius: $radius-control;
      }
    }
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: $space-1 $space-2;
    margin-left: auto;
  }

  &__type,
  &__label {
    @include label-chip;
  }

  &__assignee,
  &__effort {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
