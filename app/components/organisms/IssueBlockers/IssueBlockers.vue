<template>
  <FieldRow :heading="strings.issue.fields.blockers.heading">
    <ul v-if="issue.blockedBy.length" class="issue-blockers__list">
      <li
        v-for="blocker in issue.blockedBy"
        :key="blocker.number"
        class="issue-blockers__blocker"
        :class="blocker.open ? 'issue-blockers__blocker--open' : 'issue-blockers__blocker--closed'"
      >
        <NuxtLink
          v-if="blocker.open"
          :to="issuePath(blocker.number)"
          class="issue-blockers__link"
        >
          {{ format(strings.issue.number, { number: blocker.number }) }} {{ blocker.title }}
        </NuxtLink>

        <NuxtLink
          v-else
          :to="issuePath(blocker.number)"
          class="issue-blockers__link"
          :title="blocker.title"
          :aria-label="format(strings.issue.fields.blockers.closedName, { number: blocker.number, title: blocker.title })"
        >
          {{ format(strings.issue.fields.blockers.closedChip, { number: blocker.number }) }}
        </NuxtLink>

        <StatePill v-if="blocker.open" status="open" />

        <button
          v-if="!session.isViewer"
          type="button"
          class="issue-blockers__remove"
          :aria-label="format(strings.issue.fields.blockers.remove, { number: blocker.number })"
          @click="remove(blocker.number)"
        >
          <Icon name="close" :size="12" />
        </button>
      </li>
    </ul>

    <p v-else class="issue-blockers__none">{{ strings.issue.fields.none }}</p>

    <form v-if="!session.isViewer" class="issue-blockers__add" novalidate @submit.prevent="add">
      <label :for="numberId" class="issue-blockers__hidden">{{ strings.issue.fields.blockers.number }}</label>

      <input
        :id="numberId"
        v-model="blockerNumber"
        class="issue-blockers__field"
        inputmode="numeric"
        autocomplete="off"
        :placeholder="strings.issue.fields.blockers.placeholder"
        :aria-describedby="errorId"
      />

      <button type="submit" class="issue-blockers__submit">{{ strings.issue.fields.blockers.add }}</button>
    </form>

    <p :id="errorId" class="issue-blockers__error" aria-live="polite">{{ action.error }}</p>
  </FieldRow>
</template>

<script setup lang="ts">
import type { IssueBlockersProps } from './IssueBlockers.types';

const props = defineProps<IssueBlockersProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const action = reactive(useAction());
const numberId = useId();
const errorId = useId();
const blockerNumber = ref('');

const explainFor = (number: number) => (failure: unknown) => {
  const messages = strings.value.issue.fields.blockers;
  const code = apiErrorCode(failure);
  if (code === 'not-found') return format(messages.notFound, { number });
  if (code === 'invalid') return format(messages.invalid, { number });
  return strings.value.issue.fields.failed;
};

const remove = (number: number) => action.run(() => issuesStore.removeBlocker(props.issue.number, number), explainFor(number));

const add = async () => {
  const number = Number(blockerNumber.value.trim().replace(/^#/, ''));
  if (!Number.isInteger(number) || number < 1) {
    action.error = format(strings.value.issue.fields.blockers.notFound, { number: blockerNumber.value.trim() });
    return;
  }
  if (await action.run(() => issuesStore.addBlocker(props.issue.number, number), explainFor(number))) blockerNumber.value = '';
};
</script>

<style lang="scss" scoped>
.issue-blockers {
  &__list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $space-1;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__blocker {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1 $space-2;
    max-width: 100%;

    &--open {
      padding: $space-1 $space-2;
      border: 1px solid var(--color-rule);
      border-radius: $radius-control;
    }

    &--closed {
      @include pill;
      background: var(--color-tint-closed);
      color: var(--color-state-closed);
    }
  }

  &__link {
    color: inherit;
    text-decoration: none;
    overflow-wrap: anywhere;

    &:hover {
      text-decoration: underline;
    }
  }

  &__remove {
    display: inline-flex;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-muted);
    cursor: pointer;
  }

  &__none {
    margin: 0;
    color: var(--color-muted);
  }

  &__add {
    display: flex;
    gap: $space-2;
    margin-top: $space-2;
  }

  &__field {
    @include text-field;
    width: 80px;
  }

  &__submit {
    @include button-secondary;
  }

  &__hidden {
    @include visually-hidden;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;

    &:empty {
      display: none;
    }
  }
}
</style>
