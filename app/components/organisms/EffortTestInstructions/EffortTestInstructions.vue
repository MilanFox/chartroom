<template>
  <DisclosureSection :heading="strings.dashboard.testInstructions.heading">
    <VersionedTextEditor
      v-if="editor.editing"
      :editor="editor"
      multiline
      :label="strings.dashboard.testInstructions.label"
    />

    <div v-else class="effort-test-instructions">
      <MarkdownText v-if="effort.testInstructions?.trim()" :source="effort.testInstructions" />

      <p v-else class="effort-test-instructions__empty">{{ strings.dashboard.testInstructions.empty }}</p>

      <button
        v-if="!session.isViewer"
        ref="editButton"
        type="button"
        class="effort-test-instructions__edit"
        :aria-label="strings.dashboard.testInstructions.edit"
        @click="editor.open"
      >
        <Icon name="pencil" :size="14" />
      </button>
    </div>
  </DisclosureSection>
</template>

<script setup lang="ts">
import type { EffortTestInstructionsProps } from './EffortTestInstructions.types';

const props = defineProps<EffortTestInstructionsProps>();

const session = useSessionStore();
const { strings } = useStrings();
const editButton = useTemplateRef<HTMLButtonElement>('editButton');
const editor = reactive(useVersionedEditor(() => props.effort, 'testInstructions', editButton));
</script>

<style lang="scss" scoped>
.effort-test-instructions {
  position: relative;
  padding-right: $space-8;

  &__edit {
    @include button-quiet;
    position: absolute;
    top: 0;
    right: 0;
    color: var(--color-muted);
  }

  &__empty {
    margin: 0;
    color: var(--color-muted);
  }
}
</style>
