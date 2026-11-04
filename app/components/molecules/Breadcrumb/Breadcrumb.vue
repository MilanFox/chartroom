<template>
  <nav v-if="crumbs.length > 1" :aria-label="strings.breadcrumb.label" class="breadcrumb">
    <ol class="breadcrumb__list">
      <template v-for="(crumb, index) in crumbs" :key="index">
        <li class="breadcrumb__crumb" :class="{ 'breadcrumb__crumb--middle': index > 0 && index < lastIndex }">
          <span v-if="index === lastIndex" aria-current="page" class="breadcrumb__current">{{ crumb.label }}</span>

          <NuxtLink v-else-if="crumb.to" :to="crumb.to" class="breadcrumb__link">{{ crumb.label }}</NuxtLink>

          <span v-else>{{ crumb.label }}</span>
        </li>

        <li v-if="index === 0 && crumbs.length > 2" class="breadcrumb__crumb breadcrumb__collapsed" aria-hidden="true">
          {{ strings.breadcrumb.collapsed }}
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { BreadcrumbProps } from './Breadcrumb.types';

const props = defineProps<BreadcrumbProps>();

const { strings } = useStrings();
const lastIndex = computed(() => props.crumbs.length - 1);
</script>

<style lang="scss" scoped>
.breadcrumb {
  margin-bottom: $space-3;
  font-size: $font-size-meta;

  &__list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__crumb {
    display: flex;
    align-items: center;
    min-width: 0;
    color: var(--color-muted);

    & + &::before {
      content: '›' / '';
      padding: 0 $space-2;
      color: var(--color-muted);
    }

    &--middle {
      @include visually-hidden;

      @include respond(sm) {
        position: static;
        width: auto;
        height: auto;
        margin: 0;
        overflow: visible;
        clip-path: none;
        white-space: normal;
      }
    }
  }

  &__collapsed {
    @include respond(sm) {
      display: none;
    }
  }

  &__link {
    color: var(--color-muted);
    text-decoration: none;

    &:hover {
      color: var(--color-fg);
      text-decoration: underline;
    }
  }

  &__current {
    overflow: hidden;
    color: var(--color-fg);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
