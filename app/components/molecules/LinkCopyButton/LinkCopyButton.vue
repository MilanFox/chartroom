<template>
  <span class="link-copy">
    <button type="button" class="link-copy__button" :aria-label="format(strings.issue.fields.links.copy, { title })" @click="copyLink">
      <Icon name="copy" :size="12" />
    </button>

    <span role="status" class="link-copy__status">{{ copyMessage }}</span>
  </span>
</template>

<script setup lang="ts">
import type { LinkCopyButtonProps } from './LinkCopyButton.types';

const props = defineProps<LinkCopyButtonProps>();

const { strings, format } = useStrings();
const { copy } = useClipboard({ legacy: true });
const copyMessage = ref('');
const { start: clearMessageLater } = useTimeoutFn(() => copyMessage.value = '', 4000, { immediate: false });

const copyLink = async () => {
  copyMessage.value = '';
  try {
    await copy(props.url);
    copyMessage.value = format(strings.value.issue.fields.links.copied, { title: props.title });
  }
  catch {
    copyMessage.value = strings.value.dashboard.links.copyFailed;
  }
  clearMessageLater();
};
</script>

<style lang="scss" scoped>
.link-copy {
  display: inline-flex;
  align-items: center;
  gap: $space-1;

  &__button {
    @include button-quiet;
    display: inline-flex;
    align-items: center;
    color: var(--color-muted);
    opacity: var(--link-copy-opacity, 0);
    transition: opacity 120ms ease;

    &:focus-visible {
      opacity: 1;
    }

    @media (hover: none) {
      opacity: 1;
    }
  }

  &__status {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
