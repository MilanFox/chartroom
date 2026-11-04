<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="ICON_PATHS[name]" />
  </svg>
</template>

<script setup lang="ts">
import { ICON_PATHS } from './Icon.paths';
import type { IconProps } from './Icon.types';

withDefaults(defineProps<IconProps>(), { size: 16 });
</script>

<style lang="scss" scoped>
.icon {
  flex: none;
  vertical-align: middle;
}
</style>
