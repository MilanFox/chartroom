<template>
  <div role="group" class="field-row" :aria-labelledby="headingId">
    <h3 :id="headingId" class="field-row__heading">
      {{ heading }}<slot name="heading-extra" />
    </h3>

    <slot />
  </div>
</template>

<script setup lang="ts">
import type { FieldRowProps } from './FieldRow.types';

defineProps<FieldRowProps>();

const headingId = useId();
</script>

<style lang="scss" scoped>
.field-row {
  padding: $space-3 0;

  & + & {
    border-top: 1px solid var(--color-rule);
  }

  &__heading {
    margin: 0 0 $space-2;
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
}
</style>
