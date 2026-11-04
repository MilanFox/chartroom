<template>
  <section :id="id" class="admin-section" :aria-labelledby="headingId">
    <h2 :id="headingId" class="admin-section__heading">{{ heading }}</h2>

    <p v-if="intro" class="admin-section__intro">{{ intro }}</p>

    <slot />
  </section>
</template>

<script setup lang="ts">
import type { AdminSectionProps } from './AdminSection.types';

withDefaults(defineProps<AdminSectionProps>(), { intro: undefined });

const headingId = useId();
</script>

<style lang="scss" scoped>
.admin-section {
  @include card;
  padding: $space-4;
  scroll-margin-top: $bar-height + $space-4;

  &__heading {
    margin: 0;
    font-size: $font-size-h2;
  }

  &__intro {
    margin: $space-1 0 $space-4;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
