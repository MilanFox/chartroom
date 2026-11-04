<template>
  <ol class="line-diff">
    <li v-for="(line, index) in lines" :key="index" class="line-diff__line" :class="{ [`line-diff__line--${line.kind}`]: line.kind !== 'same' }">
      <del v-if="line.kind === 'removed'" class="line-diff__text"><span class="line-diff__sr">{{ removedLabel }}</span>{{ line.text }}</del>

      <ins v-else-if="line.kind === 'added'" class="line-diff__text"><span class="line-diff__sr">{{ addedLabel }}</span>{{ line.text }}</ins>

      <span v-else class="line-diff__text">{{ line.text }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { LineDiffProps } from './LineDiff.types';

const props = defineProps<LineDiffProps>();

const { strings } = useStrings();

const lines = computed(() => lineDiff(props.before, props.after));
const removedLabel = computed(() => `${strings.value.issue.changes.removed} `);
const addedLabel = computed(() => `${strings.value.issue.changes.added} `);
</script>

<style lang="scss" scoped>
.line-diff {
  margin: $space-2 0 0;
  padding: $space-2 0;
  border: 1px solid var(--color-rule);
  border-radius: $radius-control;
  background: var(--color-surface-alt);
  list-style: none;
  font-family: monospace;
  font-size: $font-size-meta;

  &__line {
    display: flex;
    gap: $space-2;
    padding: 0 $space-2;
    color: var(--color-fg);

    &::before {
      flex: none;
      width: 1ch;
      content: ' ';
    }

    &--removed {
      background: var(--color-tint-blocked);
      color: var(--color-state-blocked);

      &::before {
        content: '\2212';
      }
    }

    &--added {
      background: var(--color-tint-open);
      color: var(--color-state-open);

      &::before {
        content: '+';
      }
    }
  }

  &__text {
    min-height: 1lh;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    text-decoration: none;
  }

  &__sr {
    @include visually-hidden;
  }
}
</style>
