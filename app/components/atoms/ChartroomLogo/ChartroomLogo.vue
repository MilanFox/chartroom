<template>
  <div class="logo" role="img" :aria-label="strings.names.product">
    <svg class="logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle
        cx="16"
        cy="16"
        r="12.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      />

      <path d="M16 5.5 L18.6 13.4 L26.5 16 L18.6 18.6 L16 26.5 L13.4 18.6 L5.5 16 L13.4 13.4 Z" fill="currentColor" />

      <circle class="logo__pivot" cx="16" cy="16" r="2.2" />
    </svg>

    <span class="logo__word" aria-hidden="true">{{ strings.names.product }}</span>
  </div>
</template>

<script setup lang="ts">
const { strings } = useStrings();
</script>

<style lang="scss" scoped>
.logo {
  display: flex;
  align-items: center;
  gap: $space-2;
  color: var(--color-fg);

  &__mark {
    flex: none;
    width: 36px;
    height: 36px;
    color: var(--color-accent);
  }

  &__pivot {
    fill: var(--color-surface);
  }

  &__word {
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
}
</style>
