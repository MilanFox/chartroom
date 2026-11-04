<template>
  <FieldRow :heading="strings.issue.fields.labels.heading">
    <div v-for="row in rows.groups" :key="row.group.id" class="issue-labels__group">
      <template v-if="session.isViewer">
        <span class="issue-labels__group-name">{{ row.group.displayName }}</span>

        <span v-if="row.selected" class="issue-labels__chip">{{ labelGroupsStore.displayLabelOf(row.selected) }}</span>

        <span v-else class="issue-labels__none">{{ strings.issue.fields.none }}</span>
      </template>

      <template v-else>
        <label :for="`${groupIdPrefix}-${row.group.id}`" class="issue-labels__group-name">{{ row.group.displayName }}</label>

        <select
          :id="`${groupIdPrefix}-${row.group.id}`"
          class="issue-labels__select"
          :value="row.selected ?? ''"
          :disabled="action.busy"
          :aria-describedby="errorId"
          @change="choose(row.selected, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ strings.issue.fields.labels.groupNone }}</option>

          <option v-for="member in row.group.labels" :key="member.id" :value="member.id">{{ member.displayLabel }}</option>
        </select>
      </template>
    </div>

    <ul v-if="rows.freeForm.length" class="issue-labels__free-form" :aria-label="strings.issue.fields.labels.freeForm">
      <li v-for="label in rows.freeForm" :key="label" class="issue-labels__chip">
        {{ label }}

        <button
          v-if="!session.isViewer"
          type="button"
          class="issue-labels__remove"
          :aria-label="format(strings.issue.fields.labels.remove, { label })"
          @click="remove(label)"
        >
          <Icon name="close" :size="12" />
        </button>
      </li>
    </ul>

    <form v-if="!session.isViewer" class="issue-labels__add" novalidate @submit.prevent="add">
      <label :for="newLabelId" class="issue-labels__hidden">{{ strings.issue.fields.labels.new }}</label>

      <input
        :id="newLabelId"
        v-model="newLabel"
        class="issue-labels__field"
        autocomplete="off"
        :placeholder="strings.issue.fields.labels.new"
        :aria-describedby="errorId"
      />

      <button type="submit" class="issue-labels__submit">{{ strings.issue.fields.labels.add }}</button>
    </form>

    <p :id="errorId" class="issue-labels__error" aria-live="polite">{{ action.error }}</p>
  </FieldRow>
</template>

<script setup lang="ts">
import type { IssueLabelsProps } from './IssueLabels.types';

const props = defineProps<IssueLabelsProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
const action = reactive(useAction());
const groupIdPrefix = useId();
const newLabelId = useId();
const errorId = useId();
const newLabel = ref('');

await useLabelGroupsLoaded();

const rows = computed(() => labelRows(labelGroupsStore.labelGroups, props.issue.labels));

const failed = () => strings.value.issue.fields.failed;

const choose = (selected: string | null, member: string) => action.run(
  () => (member ? issuesStore.addLabel(props.issue.number, member) : issuesStore.removeLabel(props.issue.number, selected!)),
  failed,
);

const remove = (label: string) => action.run(() => issuesStore.removeLabel(props.issue.number, label), failed);

const add = async () => {
  const label = newLabel.value.trim();
  if (!label) {
    action.error = strings.value.issue.fields.labels.empty;
    return;
  }
  if (await action.run(() => issuesStore.addLabel(props.issue.number, label), failed)) newLabel.value = '';
};
</script>

<style lang="scss" scoped>
.issue-labels {
  &__group {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    align-items: center;
    gap: $space-2;
    margin-bottom: $space-2;
  }

  &__group-name {
    overflow-wrap: anywhere;
  }

  &__select {
    @include text-field;
    min-width: 0;
    padding: 0 $space-2;
  }

  &__free-form {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    margin: $space-2 0;
    padding: 0;
    list-style: none;
  }

  &__chip {
    @include label-chip;
    justify-self: start;
  }

  &__none {
    color: var(--color-muted);
  }

  &__remove {
    display: inline-flex;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
  }

  &__add {
    display: flex;
    gap: $space-2;
    margin-top: $space-2;
  }

  &__field {
    @include text-field;
    flex: 1;
    min-width: 0;
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
