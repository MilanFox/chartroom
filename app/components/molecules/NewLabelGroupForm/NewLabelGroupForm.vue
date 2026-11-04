<template>
  <form class="new-label-group-form" novalidate @submit.prevent="create">
    <h3 class="new-label-group-form__heading">{{ strings.admin.labels.newGroup }}</h3>

    <LockedField
      :id="labelDomId('new', 'id')"
      v-model="draft.id"
      name="groupId"
      :label="strings.admin.labels.groupId"
      :hint="strings.admin.labels.idHint"
      :error="errors.id"
      autocapitalize="off"
      spellcheck="false"
      @input="errors.id = ''"
    />

    <LockedField
      :id="labelDomId('new', 'name')"
      v-model="draft.displayName"
      name="groupDisplayName"
      :label="strings.admin.labels.displayNameOptional"
      autocapitalize="off"
      spellcheck="false"
    />

    <LockedField
      :id="labelDomId('new', 'first')"
      v-model="draft.firstMember"
      name="firstMember"
      :label="strings.admin.labels.firstMember"
      :error="errors.firstMember"
      autocapitalize="off"
      spellcheck="false"
      @input="errors.firstMember = ''"
    />

    <div class="new-label-group-form__submit">
      <AdminAction :label="action.busy ? strings.admin.labels.creating : strings.admin.labels.create" type="submit" variant="primary" />
    </div>

    <div role="status" class="new-label-group-form__status" :class="{ 'new-label-group-form__status--failed': feedback }">
      <template v-if="feedback">
        {{ feedback.message }}

        <ul v-if="feedback.issues.length" class="new-label-group-form__issues">
          <li v-for="number in feedback.issues" :key="number"><NuxtLink :to="issuePath(number)">#{{ number }}</NuxtLink></li>
        </ul>
      </template>
    </div>
  </form>
</template>

<script setup lang="ts">
interface Feedback {
  message: string
  issues: number[]
}

const emit = defineEmits<{ created: [id: string] }>();

const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
const draft = reactive({ id: '', displayName: '', firstMember: '' });
const errors = reactive({ id: '', firstMember: '' });
const feedback = ref<Feedback>();
const action = reactive(useAction());

const { locked } = useElevationGate();

const explain = (failure: unknown, group: string) => {
  const issues = memberClashOf(failure);
  if (issues) {
    feedback.value = { message: format(strings.value.admin.labels.errors.conflict, { group }), issues };
    return '';
  }
  const fieldError = fieldErrorOf(failure, ['id', 'labels']);
  if (!fieldError) {
    feedback.value = { message: strings.value.admin.labels.errors.failed, issues: [] };
    return '';
  }
  if (fieldError.field === 'id') errors.id = fieldError.message;
  else errors.firstMember = fieldError.message;
  focusById(labelDomId('new', fieldError.field === 'id' ? 'id' : 'first'));
  return '';
};

const create = async () => {
  if (locked.value) return;
  feedback.value = undefined;
  errors.id = '';
  errors.firstMember = '';
  const id = draft.id.trim();
  const firstMember = draft.firstMember.trim();
  const displayName = draft.displayName.trim() || null;
  const created = await action.run(
    () => labelGroupsStore.createLabelGroup({ id, displayName, labels: firstMember ? [{ id: firstMember, displayLabel: null }] : [] }),
    failure => explain(failure, displayName ?? id),
  );
  if (!created) return;
  Object.assign(draft, { id: '', displayName: '', firstMember: '' });
  emit('created', id);
};
</script>

<style lang="scss" scoped>
.new-label-group-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: $space-2 $space-3;
  margin-top: $space-3;

  @include respond(sm) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  &__heading,
  &__submit,
  &__status {
    grid-column: 1 / -1;
  }

  &__heading {
    margin: $space-6 0 0;
    font-size: $font-size-base;
  }

  &__submit {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__status {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;

    &--failed {
      @include error-line;
    }
  }

  &__issues {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    margin: $space-1 0 0;
    padding: 0;
    list-style: none;
  }
}
</style>
