<template>
  <TextEditor
    v-model="draft"
    :multiline="multiline"
    :label="label"
    :saving="editor.saving"
    :failed="editor.failed"
    :failed-message="failedMessage"
    :conflict="editor.conflict"
    @save="editor.save"
    @cancel="editor.cancel"
    @reload="editor.reload"
  />
</template>

<script setup lang="ts">
import type { VersionedTextEditorProps } from './VersionedTextEditor.types';

const props = defineProps<VersionedTextEditorProps>();

const { editor } = toRefs(props);

const draft = computed({
  get: () => editor.value.draft,
  set: (value) => {
    editor.value.draft = value;
  },
});
</script>
