<template>
  <span class="dependency-graph-progress">
    <span class="dependency-graph-progress__text">{{ text }}</span>

    <span class="dependency-graph-progress__bar" aria-hidden="true">
      <span
        v-for="status in BAR_ORDER"
        :key="status"
        :class="`dependency-graph-progress__segment dependency-graph-progress__segment--${status}`"
        :style="{ width: `${(progress[status] / progress.total) * 100}%` }"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
import type { IssueStatus } from '~/types/api';

defineProps<{
  text: string
  progress: Record<IssueStatus, number> & { total: number }
}>();

const BAR_ORDER: IssueStatus[] = ['closed', 'claimed', 'blocked', 'open'];
</script>

<style lang="scss" scoped>
.dependency-graph-progress {
  display: flex;
  flex: 1;
  align-items: center;
  gap: $space-2;

  &__text {
    margin-left: auto;
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 400;
  }

  &__bar {
    display: flex;
    flex: none;
    width: 120px;
    height: 6px;
    overflow: hidden;
    border-radius: $radius-pill;
    background: var(--color-surface-alt);
  }

  @each $status in open, claimed, blocked, closed {
    &__segment--#{$status} {
      background: var(--color-state-#{$status});
    }
  }

  &__segment--closed {
    opacity: 0.5;
  }
}
</style>
