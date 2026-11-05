<template>
  <nav class="admin-section-nav" :aria-label="strings.admin.sectionNav">
    <ul class="admin-section-nav__list">
      <li v-for="section in sections" :key="section.id">
        <NuxtLink
          :to="{ hash: `#${section.id}` }"
          class="admin-section-nav__link"
          :aria-current="currentId === section.id ? 'location' : undefined"
        >{{ section.label }}</NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import type { AdminSectionNavProps } from './AdminSectionNav.types';

const props = defineProps<AdminSectionNavProps>();

const route = useRoute();
const { strings } = useStrings();
const currentId = ref('');
let followsHash = false;

const hasReached = (section: HTMLElement) => section.getBoundingClientRect().top <= parseFloat(getComputedStyle(section).scrollMarginTop) + 1;

const sectionInView = () => {
  const root = document.documentElement;
  if (root.scrollTop > 0 && window.innerHeight + root.scrollTop >= root.scrollHeight - 1) return props.sections.at(-1)?.id;
  return props.sections.findLast(({ id }) => {
    const section = document.getElementById(id);
    return section && hasReached(section);
  })?.id;
};

onMounted(() => {
  watch(() => route.hash, (hash) => {
    currentId.value = hash.slice(1);
    followsHash = Boolean(hash);
  }, { immediate: true });
  useEventListener(window, ['wheel', 'touchmove', 'keydown'], () => followsHash = false, { passive: true });
  useEventListener(window, 'scroll', useThrottleFn(() => {
    if (!followsHash) currentId.value = sectionInView() ?? '';
  }, 100, true), { passive: true });
});
</script>

<style lang="scss" scoped>
.admin-section-nav {
  position: sticky;
  top: $bar-height;
  z-index: 5;
  margin: 0 (-$space-4);
  padding: $space-2 $space-4;
  border-bottom: 1px solid var(--color-rule);
  background: var(--color-bg);

  @include respond(sm) {
    top: $bar-height + $space-6;
    align-self: start;
    margin: 0;
    padding: 0;
    border-bottom: none;
    background: none;
  }

  &__list {
    display: flex;
    gap: $space-2;
    margin: 0;
    padding: 0;
    overflow-x: auto;
    list-style: none;

    @include respond(sm) {
      flex-direction: column;
      gap: $space-1;
      overflow: visible;
    }
  }

  &__link {
    @include label-chip;
    height: $control-height;
    border-color: var(--color-rule);
    background: var(--color-surface);
    color: var(--color-fg);
    font-size: $font-size-base;
    text-decoration: none;

    @include respond(sm) {
      display: block;
      height: auto;
      padding: $space-1 $space-2;
      border: none;
      border-radius: $radius-control;
      background: none;
      line-height: $line-height;
      white-space: normal;
    }

    &:hover {
      background: var(--color-surface-alt);
    }

    &[aria-current='location'] {
      background: var(--color-tint-accent);
      color: var(--color-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: -2px;
    }
  }
}
</style>
