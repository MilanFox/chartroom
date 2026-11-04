<template>
  <button
    v-bind="$attrs"
    :type="locked ? 'button' : type"
    class="admin-action"
    :class="`admin-action--${variant}`"
    :aria-disabled="locked ? 'true' : undefined"
    @click="activate"
  >
    {{ label }}<Icon v-if="locked" name="lock" :size="12" class="admin-action__lock" />
  </button>

  <ElevationPrompt v-if="prompting" @elevated="close" @cancel="close" />
</template>

<script setup lang="ts">
import type { AdminActionProps } from './AdminAction.types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AdminActionProps>(), { type: 'button', variant: 'secondary' });
const emit = defineEmits<{ run: [] }>();

const { locked, prompting, open, close } = useElevationGate();

const activate = (event: MouseEvent) => {
  if (!locked.value) {
    if (props.type === 'button') emit('run');
  }
  else if (prompting.value) prompting.value = null;
  else open('action', event.currentTarget);
};
</script>

<style lang="scss" scoped>
.admin-action {
  &--primary {
    @include button-primary;
  }

  &--secondary {
    @include button-secondary;
  }

  &--quiet {
    @include button-quiet;
  }

  &--danger {
    @include button-quiet;
    color: var(--color-state-blocked);
  }

  &[aria-disabled='true'] {
    border-color: var(--color-rule);
    background: var(--color-surface-alt);
    color: var(--color-muted);
    box-shadow: none;
  }

  &__lock {
    margin-left: $space-1;
  }
}
</style>
