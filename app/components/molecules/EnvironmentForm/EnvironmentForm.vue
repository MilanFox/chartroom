<template>
  <form class="environment-form" novalidate @submit.prevent="submit" @keydown.esc="emit('cancel')">
    <div v-for="field in fields" :key="field.key" class="environment-form__field">
      <label :for="`${formId}-${field.key}`" class="environment-form__label">{{ field.label }}</label>

      <input
        :id="`${formId}-${field.key}`"
        v-model="draft[field.key]"
        :name="field.key"
        :type="field.key === 'url' ? 'url' : 'text'"
        class="environment-form__input"
        autocomplete="off"
        :aria-invalid="Boolean(errors[field.key])"
        :aria-describedby="`${formId}-${field.key}-error`"
        @input="errors[field.key] = ''"
      />

      <p :id="`${formId}-${field.key}-error`" role="status" class="environment-form__error">{{ errors[field.key] }}</p>
    </div>

    <div class="environment-form__actions">
      <button type="submit" class="environment-form__save">{{ action.busy ? strings.admin.environments.saving : strings.admin.environments.save }}</button>

      <button type="button" class="environment-form__cancel" @click="emit('cancel')">{{ strings.admin.environments.cancel }}</button>

      <p role="status" class="environment-form__error">{{ action.error }}</p>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { EnvironmentFormProps } from './EnvironmentForm.types';

const props = withDefaults(defineProps<EnvironmentFormProps>(), { environment: undefined });
const emit = defineEmits<{ saved: [], cancel: [] }>();

type FieldKey = 'name' | 'url' | 'notes';

const environmentsStore = useEnvironmentsStore();
const { strings } = useStrings();
const formId = useId();
const draft = reactive<Record<FieldKey, string>>({ name: props.environment?.name ?? '', url: props.environment?.url ?? '', notes: props.environment?.notes ?? '' });
const errors = ref<Partial<Record<FieldKey, string>>>({});
const action = reactive(useAction());

const fields = computed(() => {
  const labels = strings.value.admin.environments;
  return [
    { key: 'name', label: labels.name },
    { key: 'url', label: labels.url },
    { key: 'notes', label: labels.notes },
  ] as const;
});

onMounted(() => document.getElementById(`${formId}-name`)?.focus());

const explain = (failure: unknown) => {
  const fieldError = fieldErrorOf(failure, Object.keys(draft));
  if (!fieldError) return strings.value.admin.environments.errors.failed;
  errors.value = { [fieldError.field]: fieldError.message };
  document.getElementById(`${formId}-${fieldError.field}`)?.focus();
  return '';
};

const submit = async () => {
  const saved = await action.run(() => {
    errors.value = {};
    const input = { name: draft.name.trim(), url: draft.url.trim(), notes: draft.notes.trim() || null };
    return props.environment ? environmentsStore.updateEnvironment(props.environment.id, input) : environmentsStore.createEnvironment(input);
  }, explain);
  if (saved) emit('saved');
};
</script>

<style lang="scss" scoped>
.environment-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: $space-2 $space-3;
  padding: $space-3;
  border: 1px dashed var(--color-rule);
  border-radius: $radius;

  @include respond(sm) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  &__field {
    display: flex;
    flex-direction: column;
  }

  &__label {
    margin-bottom: $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__input {
    @include text-field;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;
    font-size: $font-size-meta;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    grid-column: 1 / -1;
  }

  &__save {
    @include button-primary;
  }

  &__cancel {
    @include button-secondary;
  }
}
</style>
