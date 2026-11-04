<template>
  <section class="issue-body" :aria-label="strings.issue.body.label">
    <TextEditor
      v-if="editor.editing"
      v-model="editor.draft"
      multiline
      :label="strings.issue.body.label"
      :saving="editor.saving"
      :failed="editor.failed"
      :conflict="editor.conflict"
      @save="editor.save"
      @cancel="editor.cancel"
      @reload="editor.reload"
    />

    <template v-else>
      <button
        v-if="!session.isViewer"
        ref="editButton"
        type="button"
        class="issue-body__edit"
        :aria-label="strings.issue.body.edit"
        @click="editor.open"
      >
        <Icon name="pencil" :size="14" />
      </button>

      <MarkdownText v-if="issue.body.trim()" :source="issue.body" />

      <p v-else class="issue-body__empty">{{ strings.issue.body.empty }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { IssueBodyProps } from './IssueBody.types';

const props = defineProps<IssueBodyProps>();

const session = useSessionStore();
const { strings } = useStrings();
const editor = reactive(useVersionedEditor(() => props.issue, 'body'));
const editButton = useTemplateRef<HTMLButtonElement>('editButton');

watch(() => editor.editing, async (editing) => {
  if (editing) return;
  await nextTick();
  editButton.value?.focus();
});
</script>

<style lang="scss" scoped>
.issue-body {
  @include card;
  position: relative;
  padding: $space-4 $space-8 $space-4 $space-4;

  &__edit {
    @include button-quiet;
    position: absolute;
    top: $space-2;
    right: $space-2;
    color: var(--color-muted);
  }

  &__empty {
    margin: 0;
    color: var(--color-muted);
  }
}
</style>
