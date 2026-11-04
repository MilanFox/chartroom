<template>
  <div class="disclosure-section">
    <component :is="`h${level}`" class="disclosure-section__heading">
      <button
        :id="buttonId"
        type="button"
        class="disclosure-section__toggle"
        :aria-expanded="expanded"
        :aria-controls="regionId"
        @click="expanded = !expanded"
      >
        <Icon name="chevron-down" :size="14" class="disclosure-section__chevron" :class="{ 'disclosure-section__chevron--collapsed': !expanded }" />

        {{ heading }}

        <slot name="meta">
          <span v-if="meta" class="disclosure-section__meta">{{ meta }}</span>
        </slot>
      </button>
    </component>

    <div :id="regionId" role="region" class="disclosure-section__region" :aria-label="heading" :hidden="!expanded">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DisclosureSectionProps } from './DisclosureSection.types';

withDefaults(defineProps<DisclosureSectionProps>(), { meta: undefined, level: 2 });

const expanded = defineModel<boolean>('expanded', { default: false });

const buttonId = useId();
const regionId = useId();
</script>

<style lang="scss" scoped>
.disclosure-section {
  @include card;

  &__heading {
    margin: 0;
    font-size: $font-size-h2;
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: $space-2;
    width: 100%;
    padding: $space-3 $space-4;
    border: none;
    border-radius: $radius;
    background: none;
    color: var(--color-fg);
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--color-surface-alt);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: -2px;
    }
  }

  &__chevron {
    flex: none;
    transition: transform 120ms ease;

    &--collapsed {
      transform: rotate(-90deg);
    }
  }

  &__meta {
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 400;
  }

  &__region {
    padding: 0 $space-4 $space-4;
  }
}
</style>
