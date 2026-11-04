<template>
  <FieldRow :heading="strings.issue.fields.parent.heading">
    <template v-if="session.isViewer">
      <NuxtLink v-if="currentParent" :to="issuePath(currentParent.number)" class="issue-parent__link">{{ optionLabel(currentParent) }}</NuxtLink>

      <span v-else class="issue-parent__none">{{ strings.issue.fields.none }}</span>
    </template>

    <template v-else>
      <label :for="selectId" class="issue-parent__hidden">{{ strings.issue.fields.parent.label }}</label>

      <select
        :id="selectId"
        class="issue-parent__select"
        :value="issue.parent ?? ''"
        :disabled="action.busy"
        @change="choose(($event.target as HTMLSelectElement).value)"
      >
        <option v-if="options.allowsNone" value="">{{ strings.issue.fields.parent.none }}</option>

        <option v-for="choice in options.choices" :key="choice.number" :value="choice.number">{{ optionLabel(choice) }}</option>
      </select>
    </template>

    <ConflictNotice :conflict="conflict" @reload="reload" />

    <p class="issue-parent__error" aria-live="polite">{{ action.error }}</p>
  </FieldRow>
</template>

<script setup lang="ts">
import type { VersionConflict } from '~/utils/conflict';
import type { ParentCandidate } from '~/utils/issue-fields';
import type { IssueParentProps } from './IssueParent.types';

const props = defineProps<IssueParentProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const action = reactive(useIssueAction());
const selectId = useId();
const conflict = ref<VersionConflict | null>(null);

await useParentCandidates();

const options = computed(() => parentChoices(props.issue, issuesStore.parentCandidates));
const currentParent = computed(() => issuesStore.parentCandidates.find(({ number }) => number === props.issue.parent) ?? null);

const optionLabel = (candidate: ParentCandidate) =>
  format(strings.value.issue.fields.parent.option, { kind: strings.value.issue.kinds[candidate.kind], number: candidate.number, title: candidate.title });

const explain = (failure: unknown) => {
  conflict.value = versionConflictOf(failure);
  if (conflict.value) return '';
  return apiErrorCode(failure) === 'invalid' ? strings.value.issue.fields.parent.invalid : strings.value.issue.fields.failed;
};

const choose = (value: string) => {
  conflict.value = null;
  return action.run(() => issuesStore.edit(props.issue.number, { parent: value ? Number(value) : null }, props.issue.version), explain);
};

const reload = async () => {
  await issuesStore.load(props.issue.number);
  conflict.value = null;
};
</script>

<style lang="scss" scoped>
.issue-parent {
  &__select {
    @include text-field;
    width: 100%;
    padding: 0 $space-2;
  }

  &__link {
    color: var(--color-accent);
  }

  &__none {
    color: var(--color-muted);
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
