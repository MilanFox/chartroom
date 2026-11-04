<template>
  <div role="status" class="conflict-notice" :class="{ 'conflict-notice--shown': conflict }">
    <template v-if="conflict">
      <span>{{ conflict.holder && conflict.at ? format(strings.issue.conflict.message, { holder: conflict.holder, time: formatTimestamp(conflict.at) }) : strings.issue.conflict.generic }}</span>

      <button type="button" class="conflict-notice__reload" @click="emit('reload')">{{ strings.issue.conflict.reload }}</button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ConflictNoticeProps } from './ConflictNotice.types';

defineProps<ConflictNoticeProps>();

const emit = defineEmits<{ reload: [] }>();

const { strings, format } = useStrings();
</script>

<style lang="scss" scoped>
.conflict-notice {
  &--shown {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    margin-top: $space-2;
    padding: $space-2 $space-3;
    border-radius: $radius-control;
    background: var(--color-tint-blocked);
    color: var(--color-state-blocked);
    font-weight: 500;
  }

  &__reload {
    @include button-secondary;
  }
}
</style>
