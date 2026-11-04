<template>
  <header class="issue-header">
    <p class="issue-header__badges">
      <span class="issue-header__kind">{{ strings.issue.kinds[issue.kind] }}</span>

      <span v-if="wayfinderType" class="issue-header__type">{{ wayfinderType }}</span>

      <StatePill :status="issue.status" />
    </p>

    <div class="issue-header__title-row">
      <h1 class="issue-header__title">
        <span class="issue-header__number">{{ format(strings.issue.number, { number: issue.number }) }}</span>

        {{ issue.title }}
      </h1>

      <button
        v-if="!session.isViewer && !editor.editing"
        ref="editButton"
        type="button"
        class="issue-header__edit"
        :aria-label="strings.issue.title.edit"
        @click="editor.open"
      >
        <Icon name="pencil" :size="14" />
      </button>
    </div>

    <TextEditor
      v-if="editor.editing"
      v-model="editor.draft"
      class="issue-header__editor"
      :label="strings.issue.title.label"
      :saving="editor.saving"
      :failed="editor.failed"
      :conflict="editor.conflict"
      @save="editor.save"
      @cancel="editor.cancel"
      @reload="editor.reload"
    />

    <p class="issue-header__meta">
      {{ format(strings.issue.meta.created, { date: formatDate(issue.createdAt), holder: issue.createdBy }) }}

      <ManualChip :origin="issue.origin" />

      <template v-if="issue.state === 'closed' && issue.closedAt">{{ strings.issue.meta.separator }}{{ format(strings.issue.meta.closed, { date: formatDate(issue.closedAt) }) }}</template>

      {{ strings.issue.meta.separator }}{{ format(strings.issue.meta.updated, { date: formatDate(issue.updatedAt) }) }}
    </p>
  </header>
</template>

<script setup lang="ts">
import type { IssueHeaderProps } from './IssueHeader.types';

const props = defineProps<IssueHeaderProps>();

const session = useSessionStore();
const { strings, format } = useStrings();
const editor = reactive(useVersionedEditor(() => props.issue, 'title'));
const editButton = useTemplateRef<HTMLButtonElement>('editButton');
const wayfinderType = computed(() => wayfinderTypeOf(props.issue.labels));

watch(() => editor.editing, async (editing) => {
  if (editing) return;
  await nextTick();
  editButton.value?.focus();
});
</script>

<style lang="scss" scoped>
.issue-header {
  margin-bottom: $space-4;

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    margin: 0 0 $space-2;
  }

  &__kind {
    @include kind-chip;
  }

  &__type {
    @include label-chip;
  }

  &__title-row {
    display: flex;
    align-items: flex-start;
    gap: $space-2;
  }

  &__title {
    margin: 0;
    overflow-wrap: anywhere;
  }

  &__number {
    color: var(--color-muted);
    font-weight: 400;
  }

  &__edit {
    @include button-quiet;
    flex: none;
    margin-top: 2px;
    color: var(--color-muted);
  }

  &__editor {
    margin-top: $space-2;
  }

  &__meta {
    margin: $space-2 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
