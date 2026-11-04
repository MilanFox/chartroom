<template>
  <span class="open-count">
    <span aria-hidden="true">{{ count }}</span>

    <span class="open-count__spoken">{{ format(strings.shell.openCount, { count }) }}</span>
  </span>
</template>

<script setup lang="ts">
import type { OpenCountProps } from './OpenCount.types';

defineProps<OpenCountProps>();

const { strings, format } = useStrings();
</script>

<style lang="scss" scoped>
.open-count {
  @include pill;
  height: $count-height;
  padding: 0 $space-1;
  line-height: $count-height - 2px;
  font-variant-numeric: tabular-nums;

  &__spoken {
    @include visually-hidden;
  }
}
</style>
