<template>
  <a :href="href" target="_blank" rel="noopener noreferrer">
    <slot />

    <span class="external-link__new-tab">&nbsp;{{ strings.shell.opensInNewTab }}</span>
  </a>
</template>

<script setup lang="ts">
import type { ExternalLinkProps } from './ExternalLink.types';

defineProps<ExternalLinkProps>();

const { strings } = useStrings();
</script>

<style lang="scss" scoped>
.external-link__new-tab {
  @include visually-hidden;
}
</style>
