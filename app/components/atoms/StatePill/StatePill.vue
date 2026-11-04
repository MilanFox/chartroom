<template>
  <span :class="`state-pill state-pill--${status}`">{{ strings.states[status] }}</span>
</template>

<script setup lang="ts">
import type { StatePillProps } from './StatePill.types';

defineProps<StatePillProps>();

const { strings } = useStrings();
</script>

<style lang="scss" scoped>
.state-pill {
  @each $status in open, claimed, blocked, closed {
    &--#{$status} {
      @include state-pill($status);
    }
  }
}
</style>
