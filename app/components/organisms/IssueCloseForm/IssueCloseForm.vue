<template>
  <section v-if="issue.state === 'closed'" class="issue-close" :aria-labelledby="headingId">
    <h2 :id="headingId" class="issue-close__heading">{{ strings.issue.close.closedHeading }}</h2>

    <div class="issue-close__closed">
      <span v-if="issue.closedAt">{{ format(strings.issue.close.closedAt, { date: formatDate(issue.closedAt) }) }}</span>

      <button v-if="!session.isViewer" type="button" class="issue-close__reopen" :disabled="action.busy" @click="reopen">{{ strings.issue.close.reopen }}</button>
    </div>

    <p class="issue-close__error" aria-live="polite">{{ action.error }}</p>
  </section>

  <section v-else-if="!session.isViewer" class="issue-close" :aria-labelledby="headingId">
    <h2 :id="headingId" class="issue-close__heading">{{ strings.issue.close.heading }}</h2>

    <form class="issue-close__form" novalidate @submit.prevent="close">
      <label :for="resolutionId" class="issue-close__label">{{ strings.issue.close.label }}</label>

      <textarea :id="resolutionId" v-model="resolution" class="issue-close__field" rows="3" :aria-describedby="errorId" />

      <p :id="errorId" class="issue-close__error" aria-live="polite">{{ action.error }}</p>

      <div>
        <button type="submit" class="issue-close__submit">{{ action.busy ? strings.issue.close.closing : strings.issue.close.close }}</button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { IssueCloseFormProps } from './IssueCloseForm.types';

const props = defineProps<IssueCloseFormProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const action = reactive(useIssueAction());
const headingId = useId();
const resolutionId = useId();
const errorId = useId();
const resolution = ref('');

const failed = () => strings.value.issue.fields.failed;

const close = async () => {
  if (await action.run(() => issuesStore.close(props.issue.number, resolution.value), failed)) resolution.value = '';
};

const reopen = () => action.run(() => issuesStore.reopen(props.issue.number), failed);
</script>

<style lang="scss" scoped>
.issue-close {
  @include card;
  margin-top: $space-6;
  padding: $space-4;

  &__heading {
    margin: 0 0 $space-2;
    color: var(--color-muted);
    font-size: $font-size-meta;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__closed {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-1;
  }

  &__label {
    font-size: $font-size-meta;
    color: var(--color-muted);
  }

  &__field {
    @include text-field;
    height: auto;
    padding: $space-2 $space-3;
    resize: vertical;
  }

  &__submit {
    @include button-primary;
  }

  &__reopen {
    @include button-secondary;
  }

  &__error {
    @include error-line;
    margin: 0;

    &:empty {
      display: none;
    }
  }
}
</style>
