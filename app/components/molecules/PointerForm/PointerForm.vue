<template>
  <form class="pointer-form" novalidate @submit.prevent="submit" @keydown.esc="emit('cancel')">
    <div v-for="field in fields" :key="field.key" class="pointer-form__field">
      <label :for="`${formId}-${field.key}`" class="pointer-form__label">{{ field.label }}</label>

      <input
        :id="`${formId}-${field.key}`"
        v-model="draft[field.key]"
        :name="field.key"
        class="pointer-form__input"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="Boolean(errors[field.key])"
        :aria-describedby="`${formId}-${field.key}-error`"
        @input="errors[field.key] = ''"
      />

      <p :id="`${formId}-${field.key}-error`" role="status" class="pointer-form__error">{{ errors[field.key] }}</p>
    </div>

    <div class="pointer-form__field">
      <label :for="`${formId}-environment`" class="pointer-form__label">{{ strings.admin.environments.environment }}</label>

      <select
        :id="`${formId}-environment`"
        v-model="environment"
        name="environment"
        class="pointer-form__input"
        :aria-invalid="Boolean(errors.environment)"
        :aria-describedby="`${formId}-environment-error`"
        @change="errors.environment = ''"
      >
        <option :value="null">{{ strings.admin.environments.anyEnvironment }}</option>

        <option v-for="option in admin.environments" :key="option.id" :value="option.id">{{ option.name }}</option>
      </select>

      <p :id="`${formId}-environment-error`" role="status" class="pointer-form__error">{{ errors.environment }}</p>
    </div>

    <div class="pointer-form__actions">
      <button type="submit" class="pointer-form__save">{{ submitting ? strings.admin.environments.saving : strings.admin.environments.savePointer }}</button>

      <button type="button" class="pointer-form__cancel" @click="emit('cancel')">{{ strings.admin.environments.cancel }}</button>

      <p role="status" class="pointer-form__error">{{ formError }}</p>
    </div>
  </form>
</template>

<script setup lang="ts">
const emit = defineEmits<{ saved: [], cancel: [] }>();

type TextKey = 'label' | 'accountName' | 'whereToFind';

const admin = useAdminStore();
const { strings } = useStrings();
const formId = useId();
const draft = reactive<Record<TextKey, string>>({ label: '', accountName: '', whereToFind: '' });
const environment = ref<number | null>(null);
const errors = ref<Partial<Record<TextKey | 'environment', string>>>({});
const formError = ref('');
const submitting = ref(false);

const fields = computed(() => {
  const labels = strings.value.admin.environments;
  return [
    { key: 'label', label: labels.label },
    { key: 'accountName', label: labels.accountName },
    { key: 'whereToFind', label: labels.whereToFind },
  ] as const;
});

onMounted(() => document.getElementById(`${formId}-label`)?.focus());

const submit = async () => {
  if (submitting.value) return;
  submitting.value = true;
  errors.value = {};
  formError.value = '';
  try {
    await admin.createPointer({ label: draft.label.trim(), accountName: draft.accountName.trim(), whereToFind: draft.whereToFind.trim(), environment: environment.value });
    emit('saved');
  }
  catch (failure) {
    const field = apiErrorField(failure) as TextKey | 'environment' | null;
    if (field && (field in draft || field === 'environment')) {
      errors.value = { [field]: apiErrorMessage(failure) };
      document.getElementById(`${formId}-${field}`)?.focus();
    }
    else {
      formError.value = strings.value.admin.environments.errors.failed;
    }
  }
  finally {
    submitting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.pointer-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: $space-2 $space-3;
  padding: $space-3;
  border: 1px dashed var(--color-rule);
  border-radius: $radius;

  @include respond(sm) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
