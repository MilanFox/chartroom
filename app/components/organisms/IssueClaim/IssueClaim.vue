<template>
  <FieldRow :heading="strings.issue.fields.claim.heading">
    <div class="issue-claim">
      <span>{{ issue.assignee ? format(strings.issue.fields.claim.claimedBy, { slug: issue.assignee }) : strings.issue.fields.claim.unclaimed }}</span>

      <template v-if="!session.isViewer">
        <button v-if="issue.assignee" type="button" class="issue-claim__action" :disabled="action.busy" @click="unclaim">{{ strings.issue.fields.claim.unclaim }}</button>

        <button v-else-if="issue.state === 'open'" type="button" class="issue-claim__action" :disabled="action.busy" @click="claim">{{ strings.issue.fields.claim.claim }}</button>
      </template>
    </div>

    <p class="issue-claim__error" aria-live="polite">{{ action.error }}</p>
  </FieldRow>
</template>

<script setup lang="ts">
import type { IssueClaimProps } from './IssueClaim.types';

const props = defineProps<IssueClaimProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const action = reactive(useIssueAction());

const explain = (failure: unknown) => {
  const claimConflict = claimConflictOf(failure);
  if (!claimConflict) return strings.value.issue.fields.failed;
  issuesStore.load(props.issue.number);
  const messages = strings.value.issue.fields.claim;
  return claimConflict.holder ? format(messages.heldBy, { slug: claimConflict.holder }) : messages.heldBySomeone;
};

const claim = () => action.run(() => issuesStore.claim(props.issue.number), explain);

const unclaim = () => action.run(() => issuesStore.unassign(props.issue.number), explain);
</script>

<style lang="scss" scoped>
.issue-claim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-2;

  &__action {
    @include button-secondary;
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
