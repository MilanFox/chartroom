<template>
  <div class="list-disclosure">
    <button type="button" class="list-disclosure__toggle" :aria-expanded="expanded" :aria-controls="regionId" @click="expanded = !expanded">
      <Icon name="chevron-down" :size="14" class="list-disclosure__chevron" :class="{ 'list-disclosure__chevron--collapsed': !expanded }" />

      {{ format(expanded ? strings.admin.listDisclosure.hide : strings.admin.listDisclosure.show, { list }) }}
    </button>

    <div :id="regionId" class="list-disclosure__region" :hidden="!expanded">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ListDisclosureProps } from './ListDisclosure.types';

defineProps<ListDisclosureProps>();

const expanded = defineModel<boolean>('expanded', { default: false });

const { strings, format } = useStrings();
const regionId = useId();
</script>

<style lang="scss" scoped>
.list-disclosure {
  &__toggle {
    @include button-quiet;
    display: inline-flex;
    align-items: center;
    gap: $space-1;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__chevron {
    flex: none;
    transition: transform 120ms ease;

    &--collapsed {
      transform: rotate(-90deg);
    }
  }

  &__region {
    margin-top: $space-2;
  }
}
</style>
