<template>
  <li role="none">
    <NuxtLink
      v-if="to"
      :to="to"
      role="menuitem"
      tabindex="-1"
      class="menu-item"
    >
      <slot />
    </NuxtLink>

    <ExternalLink
      v-else-if="href"
      :href="href"
      role="menuitem"
      tabindex="-1"
      class="menu-item"
    >
      <slot />
    </ExternalLink>

    <button
      v-else
      type="button"
      role="menuitem"
      tabindex="-1"
      class="menu-item"
      @click="emit('select')"
    >
      <slot />
    </button>
  </li>
</template>

<script setup lang="ts">
import type { MenuItemProps } from './MenuItem.types';

defineProps<MenuItemProps>();

const emit = defineEmits<{ select: [] }>();
</script>

<style lang="scss" scoped>
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  width: 100%;
  min-height: $control-height;
  padding: $space-1 $space-2;
  border: none;
  border-radius: $radius-control;
  background: transparent;
  color: var(--color-fg);
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--color-surface-alt);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  &.router-link-exact-active {
    font-weight: 600;
  }
}
</style>
