<template>
  <div ref="root" class="menu-button">
    <button
      ref="trigger"
      type="button"
      class="menu-button__trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <slot name="trigger" />

      <Icon name="chevron-down" :size="14" />
    </button>

    <ul
      v-show="open"
      :id="menuId"
      ref="menu"
      role="menu"
      :aria-label="label"
      class="menu-button__menu"
      :class="`menu-button__menu--${align}`"
      @keydown="onMenuKeydown"
      @click="onMenuClick"
    >
      <slot />
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { MenuButtonProps } from './MenuButton.types';

withDefaults(defineProps<MenuButtonProps>(), { align: 'start' });

const root = useTemplateRef('root');
const trigger = useTemplateRef('trigger');
const menu = useTemplateRef('menu');
const menuId = useId();
const open = ref(false);

const menuItems = () => [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

const focusItem = (index: number) => {
  const items = menuItems();
  items[(index + items.length) % items.length]?.focus();
};

const openMenu = async (focusIndex: number) => {
  open.value = true;
  await nextTick();
  focusItem(focusIndex);
};

const close = (returnFocus: boolean) => {
  open.value = false;
  if (returnFocus) trigger.value?.focus();
};

const toggle = () => (open.value ? close(true) : openMenu(0));

const onTriggerKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  openMenu(event.key === 'ArrowDown' ? 0 : -1);
};

const typeAheadIndex = (items: HTMLElement[], current: number, key: string) => {
  const ordered = [...items.slice(current + 1), ...items.slice(0, current + 1)];
  const match = ordered.find(item => item.textContent?.trim().toLowerCase().startsWith(key.toLowerCase()));
  return match ? items.indexOf(match) : current;
};

const onMenuKeydown = (event: KeyboardEvent) => {
  const items = menuItems();
  const current = items.indexOf(document.activeElement as HTMLElement);
  const targets: Record<string, number> = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: -1 };
  if (event.key in targets) {
    event.preventDefault();
    focusItem(targets[event.key]!);
  }
  else if (event.key === 'Escape') {
    event.preventDefault();
    close(true);
  }
  else if (event.key === 'Tab') close(false);
  else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) focusItem(typeAheadIndex(items, current, event.key));
};

const onMenuClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('[role="menuitem"]')) close(true);
};

onClickOutside(root, () => open.value && close(false));
</script>

<style lang="scss" scoped>
.menu-button {
  position: relative;

  &__trigger {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
    height: $control-height;
    padding: 0 $space-2;
    border: none;
    border-radius: $radius-control;
    background: transparent;
    color: var(--color-fg);
    font: inherit;
    cursor: pointer;

    &:hover,
    &[aria-expanded='true'] {
      background: var(--color-surface-alt);
    }
  }

  &__menu {
    @include card;
    position: absolute;
    top: calc(100% + #{$space-1});
    z-index: 20;
    min-width: 220px;
    max-height: 70vh;
    margin: 0;
    padding: $space-1;
    overflow-y: auto;
    list-style: none;

    &--start {
      left: 0;
    }

    &--end {
      right: 0;
    }
  }
}
</style>
