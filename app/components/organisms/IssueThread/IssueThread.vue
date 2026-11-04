<template>
  <section class="issue-thread" :aria-labelledby="headingId">
    <header class="issue-thread__header">
      <h2 :id="headingId" class="issue-thread__heading">
        {{ strings.issue.thread.heading }}

        <span class="issue-thread__count">{{ format(strings.issue.thread.count, { count: issue.comments.length }) }}</span>
      </h2>

      <button type="button" role="switch" class="issue-thread__toggle" :aria-checked="showChanges" @click="showChanges = !showChanges">
        {{ strings.issue.changes.toggle }}
      </button>
    </header>

    <ol v-if="entries.length" class="issue-thread__entries">
      <li v-for="entry in entries" :key="`${entry.kind}-${entry.id}`" class="issue-thread__entry">
        <CommentItem v-if="entry.kind === 'comment'" :comment="entry.comment" />

        <ChangeRow v-else :group="entry" />
      </li>
    </ol>

    <p v-else class="issue-thread__empty">{{ strings.issue.thread.empty }}</p>

    <p v-if="session.isViewer" class="issue-thread__sign-in">{{ strings.issue.thread.signIn }}</p>

    <form v-else class="issue-thread__form" novalidate @submit.prevent="post">
      <label :for="commentId" class="issue-thread__label">{{ format(strings.issue.thread.commentLabel, { slug: session.me?.slug ?? '' }) }}</label>

      <textarea :id="commentId" v-model="draft" class="issue-thread__field" rows="4" :aria-describedby="errorId" />

      <p :id="errorId" class="issue-thread__error" aria-live="polite">{{ action.error }}</p>

      <div>
        <button type="submit" class="issue-thread__submit">{{ action.busy ? strings.issue.thread.posting : strings.issue.thread.comment }}</button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { IssueThreadProps } from './IssueThread.types';

const props = defineProps<IssueThreadProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const action = reactive(useIssueAction());
const headingId = useId();
const commentId = useId();
const errorId = useId();
const draft = ref('');
const showChanges = useLocalStorage('chartroom:show-changes', true, { initOnMounted: true });
const changes = useIssueChanges(() => props.issue);

const entries = computed(() => threadEntries(showChanges.value ? changes.value : [], props.issue.comments));

const post = async () => {
  if (!draft.value.trim()) {
    action.error = strings.value.issue.thread.emptyComment;
    return;
  }
  if (await action.run(() => issuesStore.addComment(props.issue.number, draft.value), () => strings.value.issue.fields.failed)) draft.value = '';
};
</script>

<style lang="scss" scoped>
.issue-thread {
  margin-top: $space-6;

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: $space-2;
    padding-bottom: $space-2;
    border-bottom: 1px solid var(--color-rule);
  }

  &__heading {
    margin: 0;
  }

  &__count {
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 400;
  }

  &__toggle {
    @include button-quiet;
    margin-left: auto;
    font-weight: 400;

    &::before {
      display: inline-block;
      width: $space-3;
      margin-right: $space-1;
      content: '\2610';
    }

    &[aria-checked='true']::before {
      content: '\2611';
    }
  }

  &__entries {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__entry + &__entry {
    border-top: 1px solid var(--color-rule);
  }

  &__empty,
  &__sign-in {
    margin: $space-3 0;
    color: var(--color-muted);
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    margin-top: $space-3;
  }

  &__label {
    font-size: $font-size-meta;
    font-weight: 600;
    color: var(--color-muted);
  }

  &__field {
    @include text-field;
    height: auto;
    padding: $space-2 $space-3;
    resize: vertical;
  }

  &__error {
    @include error-line;
    margin: 0;

    &:empty {
      display: none;
    }
  }

  &__submit {
    @include button-secondary;
  }
}
</style>
