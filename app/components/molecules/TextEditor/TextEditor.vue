<template>
  <form class="text-editor" novalidate @submit.prevent="emit('save')" @keydown.esc="conflict || emit('cancel')">
    <label :for="fieldId" class="text-editor__label">{{ label }}</label>

    <textarea
      v-if="multiline"
      :id="fieldId"
      ref="field"
      v-model="draft"
      class="text-editor__field text-editor__field--multiline"
      rows="12"
      :aria-describedby="errorId"
    />

    <input
      v-else
      :id="fieldId"
      ref="field"
      v-model="draft"
      class="text-editor__field"
      autocomplete="off"
      :aria-describedby="errorId"
    />

    <ConflictNotice :conflict="conflict ?? null" @reload="emit('reload')" />

    <p :id="errorId" class="text-editor__error" aria-live="polite">{{ failed ? strings.issue.editor.failed : '' }}</p>

    <div class="text-editor__actions">
      <button type="submit" class="text-editor__save">{{ saving ? strings.issue.editor.saving : strings.issue.editor.save }}</button>

      <button type="button" class="text-editor__cancel" @click="emit('cancel')">{{ strings.issue.editor.cancel }}</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { TextEditorProps } from './TextEditor.types';

defineProps<TextEditorProps>();

const emit = defineEmits<{ save: [], cancel: [], reload: [] }>();

const draft = defineModel<string>({ required: true });

const { strings } = useStrings();
const fieldId = useId();
const errorId = useId();
const field = useTemplateRef<HTMLInputElement | HTMLTextAreaElement>('field');

onMounted(() => field.value?.focus());
</script>

<style lang="scss" scoped>
.text-editor {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__label {
    font-size: $font-size-meta;
    font-weight: 600;
    color: var(--color-muted);
  }

  &__field {
    @include text-field;
    width: 100%;

    &--multiline {
      height: auto;
      min-height: 200px;
      padding: $space-2 $space-3;
      resize: vertical;
    }
  }

  &__error {
    @include error-line;
    margin: 0;

    &:empty {
      display: none;
    }
  }

  &__actions {
    display: flex;
    gap: $space-2;
    margin-top: $space-1;
  }

  &__save {
    @include button-primary;
  }

  &__cancel {
    @include button-secondary;
  }
}
</style>
