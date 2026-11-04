<template>
  <span class="locked-select">
    <select
      :value="value"
      class="locked-select__select"
      :aria-label="label"
      :aria-disabled="locked ? 'true' : undefined"
      v-on="lockedControl('select')"
      @change="onChange"
    >
      <slot />
    </select>

    <Icon v-if="locked" name="lock" :size="12" />
  </span>

  <ElevationPrompt v-if="prompting" @elevated="close" @cancel="close" />
</template>

<script setup lang="ts">
import type { LockedSelectProps } from './LockedSelect.types';

const props = defineProps<LockedSelectProps>();
const emit = defineEmits<{ change: [value: string] }>();

const { locked, prompting, close, lockedControl } = useElevationGate();

const onChange = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  if (locked.value) select.value = props.value;
  else emit('change', select.value);
};
</script>

<style lang="scss" scoped>
.locked-select {
  display: flex;
  align-items: center;
  gap: $space-1;
  min-width: 0;
  color: var(--color-muted);

  &__select {
    @include text-field;
    flex: 1 1 auto;
    min-width: 0;

    &[aria-disabled='true'] {
      border-color: var(--color-rule);
      background: var(--color-surface-alt);
      color: var(--color-muted);
    }
  }
}
</style>
