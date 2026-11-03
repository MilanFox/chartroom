<template>
  <button
    class="demo-button"
    :class="[`demo-button--size-${size}`, `demo-button--variant-${variant}`, { 'demo-button--disabled': disabled }]"
    :disabled="disabled"
  >
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
// SCAFFOLD FILE — shows the app-component pattern. Safe to delete once you add a real one.
import type { DemoButtonProps } from './DemoButton.types.ts';

withDefaults(defineProps<DemoButtonProps>(), {
  size: 'md',
  variant: 'primary',
  disabled: false,
});
</script>

<style lang="scss" scoped>
.demo-button {
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, opacity 0.15s ease;

  &--size-sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  &--size-md {
    padding: 10px 16px;
    font-size: 14px;
  }

  &--size-lg {
    padding: 14px 20px;
    font-size: 16px;
  }

  &--variant-primary {
    background: #2563eb;
    color: #fff;
  }

  &--variant-secondary {
    background: #e5e7eb;
    color: #111827;
  }

  &--variant-ghost {
    background: transparent;
    color: #2563eb;
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
