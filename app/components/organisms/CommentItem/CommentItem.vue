<template>
  <article :id="`comment-${comment.id}`" class="comment-item" :class="{ 'comment-item--resolution': comment.resolution }" :aria-labelledby="authorId">
    <header class="comment-item__header">
      <span :id="authorId" class="comment-item__author">{{ comment.author }}</span>

      <time class="comment-item__time" :datetime="comment.createdAt">{{ formatTimestamp(comment.createdAt) }}</time>

      <span v-if="comment.resolution" class="comment-item__resolution">{{ strings.issue.thread.resolution }}</span>

      <ManualChip :origin="comment.origin" />

      <span v-if="comment.updatedAt !== comment.createdAt" class="comment-item__edited">{{ strings.issue.thread.edited }}</span>

      <span v-if="own && !editing && !confirming" class="comment-item__actions">
        <button ref="editButton" type="button" class="comment-item__action" @click="startEditing">{{ strings.issue.thread.edit }}</button>

        <button ref="deleteButton" type="button" class="comment-item__action" @click="confirming = true">{{ strings.issue.thread.delete }}</button>
      </span>
    </header>

    <InlineConfirm
      v-if="confirming"
      class="comment-item__confirm"
      :message="strings.issue.thread.confirmDelete"
      :confirm-label="strings.issue.thread.delete"
      :keep-label="strings.issue.thread.keep"
      @confirm="remove"
      @keep="keep"
    />

    <TextEditor
      v-if="editing"
      v-model="draft"
      multiline
      :label="strings.issue.thread.editLabel"
      :saving="action.busy"
      :failed="Boolean(action.error)"
      @save="save"
      @cancel="stopEditing"
    />

    <MarkdownText v-else :source="comment.body" class="comment-item__body" />
  </article>
</template>

<script setup lang="ts">
import type { CommentItemProps } from './CommentItem.types';

const props = defineProps<CommentItemProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings } = useStrings();
const action = reactive(useAction());
const authorId = useId();
const editButton = useTemplateRef<HTMLButtonElement>('editButton');
const deleteButton = useTemplateRef<HTMLButtonElement>('deleteButton');
const editing = ref(false);
const confirming = ref(false);
const draft = ref('');

const own = computed(() => Boolean(session.me?.slug) && session.me?.slug === props.comment.author);

const failed = () => strings.value.issue.fields.failed;

const startEditing = () => {
  draft.value = props.comment.body;
  action.error = '';
  editing.value = true;
};

const stopEditing = async () => {
  editing.value = false;
  await nextTick();
  editButton.value?.focus();
};

const save = async () => {
  if (await action.run(() => issuesStore.editComment(props.comment.issue, props.comment.id, draft.value), failed)) await stopEditing();
};

const keep = async () => {
  confirming.value = false;
  await nextTick();
  deleteButton.value?.focus();
};

const remove = () => action.run(() => issuesStore.deleteComment(props.comment.issue, props.comment.id), failed);
</script>

<style lang="scss" scoped>
.comment-item {
  padding: $space-3 0;

  &--resolution {
    padding: $space-3;
    border-left: 3px solid var(--color-state-open);
    border-radius: $radius-control;
    background: var(--color-tint-open);
  }

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1 $space-2;
    margin-bottom: $space-1;
    font-size: $font-size-meta;
  }

  &__author {
    font-weight: 600;
  }

  &__time,
  &__edited {
    color: var(--color-muted);
  }

  &__resolution {
    @include state-pill(open);
  }

  &__actions {
    display: inline-flex;
    gap: $space-1;
    margin-left: auto;
  }

  &__action {
    @include button-quiet;
  }

  &__confirm {
    margin-bottom: $space-2;
  }
}
</style>
