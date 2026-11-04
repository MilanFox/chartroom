<template>
  <span v-if="origin === 'ui'" class="manual-chip">{{ strings.issue.manual }}</span>
</template>

<script setup lang="ts">
import type { ManualChipProps } from './ManualChip.types';

defineProps<ManualChipProps>();

const { strings } = useStrings();
</script>

<style lang="scss" scoped>
.manual-chip {
  @include manual-chip;
}
</style>
