<template>
  <div role="group" class="inline-confirm" :aria-labelledby="messageId">
    <span :id="messageId">{{ message }}</span>

    <button ref="confirmButton" type="button" class="inline-confirm__danger" @click="emit('confirm')">{{ confirmLabel }}</button>

    <button type="button" class="inline-confirm__keep" @click="emit('keep')">{{ keepLabel }}</button>

    <p role="status" class="inline-confirm__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { InlineConfirmProps } from './InlineConfirm.types';

defineProps<InlineConfirmProps>();
const emit = defineEmits<{ confirm: [], keep: [] }>();

const messageId = useId();
const confirmButton = useTemplateRef<HTMLButtonElement>('confirmButton');

onMounted(() => confirmButton.value?.focus());
</script>

<style lang="scss" scoped>
.inline-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-3;
  border-radius: $radius-control;
  background: var(--color-tint-blocked);
  white-space: normal;

  &__danger {
    @include button-secondary;
    color: var(--color-state-blocked);
  }

  &__keep {
    @include button-quiet;
    height: $control-height;
  }

  &__error {
    @include error-line;
    flex-basis: 100%;
    margin: 0;
    font-size: $font-size-meta;

    &:empty {
      @include visually-hidden;
    }
  }
}
</style>
