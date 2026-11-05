<template>
  <ClientOnly>
    <!-- eslint-disable-next-line vue/no-v-html -- sanitised by useMarkdown -->
    <div class="markdown" v-html="html" />

    <template #fallback>
      <div class="markdown markdown--plain">{{ source }}</div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { MarkdownTextProps } from './MarkdownText.types';

const props = withDefaults(defineProps<MarkdownTextProps>(), { minHeadingLevel: 1 });

const { render } = useMarkdown();
const html = computed(() => render(props.source, props.minHeadingLevel) ?? '');
</script>

<style lang="scss" scoped>
.markdown {
  overflow-wrap: anywhere;

  &--plain {
    white-space: pre-wrap;
  }

  :deep(> :first-child) {
    margin-top: 0;
  }

  :deep(> :last-child) {
    margin-bottom: 0;
  }

  :deep(:is(h1, h2, h3, h4, h5, h6)) {
    margin: $space-4 0 $space-2;
    font-size: $font-size-base;
    font-weight: 600;
    line-height: $line-height-heading;
  }

  :deep(:is(p, ul, ol, pre, blockquote, table)) {
    margin: 0 0 $space-3;
  }

  :deep(:is(ul, ol)) {
    padding-left: $space-6;
  }

  :deep(a) {
    color: var(--color-accent);
  }

  :deep(blockquote) {
    padding: $space-2 $space-3;
    border-left: 3px solid var(--color-frontier);
    border-radius: $radius-control;
    background: var(--color-surface-alt);
    color: var(--color-muted);
    font-style: italic;
  }

  :deep(code) {
    padding: 1px $space-1;
    border-radius: $radius-control;
    background: var(--color-surface-alt);
    font-size: $font-size-meta;
  }

  :deep(pre) {
    padding: $space-3;
    overflow-x: auto;
    border-radius: $radius-control;
    background: var(--color-surface-alt);

    code {
      padding: 0;
    }
  }

  :deep(table) {
    border-collapse: collapse;
  }

  :deep(:is(th, td)) {
    padding: $space-1 $space-2;
    border: 1px solid var(--color-rule);
  }
}
</style>
