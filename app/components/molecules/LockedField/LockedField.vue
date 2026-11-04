<template>
  <div class="locked-field" :class="{ 'locked-field--inline': inline }">
    <label :for="inputId" class="locked-field__label">{{ label }}<Icon v-if="locked" name="lock" :size="12" class="locked-field__lock" /></label>

    <input
      v-bind="$attrs"
      :id="inputId"
      v-model="value"
      class="locked-field__input"
      autocomplete="off"
      :readonly="locked"
      :aria-disabled="locked ? 'true' : undefined"
      :aria-invalid="Boolean(error)"
      :aria-describedby="`${hint ? `${hintId} ` : ''}${errorId}`"
      v-on="lockedControl('field')"
      @input="emit('input')"
    />

    <p v-if="hint" :id="hintId" class="locked-field__hint">{{ hint }}</p>

    <p :id="errorId" role="status" class="locked-field__error">{{ error }}</p>

    <ElevationPrompt v-if="prompting" @elevated="close" @cancel="close" />
  </div>
</template>

<script setup lang="ts">
import type { LockedFieldProps } from './LockedField.types';

defineOptions({ inheritAttrs: false });

const props = defineProps<LockedFieldProps>();
const emit = defineEmits<{ input: [] }>();
const value = defineModel<string | undefined>({ required: true });

const generatedId = useId();
const inputId = computed(() => props.id ?? generatedId);
const hintId = useId();
const errorId = useId();

const { locked, prompting, close, lockedControl } = useElevationGate();
</script>

<style lang="scss" scoped>
.locked-field {
  display: flex;
  flex-direction: column;
  min-width: 0;

  &--inline {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
    align-items: baseline;
    gap: 0 $space-3;

    > :not(label) {
      grid-column: 2;
    }
  }

  &__label {
    margin-bottom: $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &--inline &__label {
    margin-bottom: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow-wrap: anywhere;
  }

  &__input {
    @include text-field;

    &:read-only {
      border-color: var(--color-rule);
      background: var(--color-surface-alt);
      color: var(--color-muted);
    }
  }

  &__lock {
    margin-left: $space-1;
  }

  &__hint {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;
    font-size: $font-size-meta;
  }
}
</style>
