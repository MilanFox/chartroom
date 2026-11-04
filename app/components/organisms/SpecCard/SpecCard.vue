<template>
  <article class="spec-card" :aria-labelledby="titleId">
    <div class="spec-card__top">
      <h3 :id="titleId" class="spec-card__title">
        <span class="spec-card__kind">{{ strings.issue.kinds.spec }}</span>

        <span class="spec-card__number">{{ format(strings.issue.number, { number: spec.number }) }}</span>

        {{ spec.title }}
      </h3>

      <StatePill :status="spec.status" />

      <button
        type="button"
        class="spec-card__open"
        aria-haspopup="dialog"
        :aria-label="format(strings.dashboard.specs.openNamed, { number: spec.number, title: spec.title })"
        @click="emit('open', spec.number)"
      >
        {{ strings.dashboard.specs.open }}
      </button>
    </div>

    <p v-if="spec.excerpt" class="spec-card__excerpt">{{ spec.excerpt }}</p>

    <p class="spec-card__counts">{{ format(strings.dashboard.specs.counts, { ...counts, artifacts }) }}</p>
  </article>
</template>

<script setup lang="ts">
import type { SpecCardProps } from './SpecCard.types';

defineProps<SpecCardProps>();

const emit = defineEmits<{ open: [number: number] }>();

const { strings, format } = useStrings();
const titleId = useId();
</script>

<style lang="scss" scoped>
.spec-card {
  @include card;
  padding: $space-3 $space-4;

  &__top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1 $space-2;
    margin: 0;
    font-size: $font-size-base;
    overflow-wrap: anywhere;
  }

  &__kind {
    @include kind-chip;
  }

  &__number {
    color: var(--color-muted);
    font-weight: 400;
  }

  &__open {
    @include button-secondary;
    margin-left: auto;
  }

  &__excerpt {
    display: -webkit-box;
    margin: $space-2 0 0;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  &__counts {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
