<template>
  <AdminSection id="settings" :heading="strings.shell.adminSections.settings" :intro="strings.admin.settings.intro">
    <form class="admin-settings" novalidate @submit.prevent="save">
      <div class="admin-settings__grid">
        <div class="admin-settings__names">
          <div v-for="field in nameFields" :key="field.key" class="admin-settings__field">
            <label :for="`${formId}-${field.key}`" class="admin-settings__label">{{ field.label }}<Icon v-if="locked" name="lock" :size="12" class="admin-settings__lock" /></label>

            <input
              :id="`${formId}-${field.key}`"
              v-model="draft[field.key]"
              :name="field.key"
              class="admin-settings__input"
              autocomplete="off"
              :readonly="locked"
              :aria-disabled="locked ? 'true' : undefined"
              :aria-invalid="Boolean(errors[field.error])"
              :aria-describedby="`${field.hint ? `${formId}-${field.key}-hint ` : ''}${formId}-${field.key}-error`"
              v-on="lockedControl(field.key)"
              @input="errors[field.error] = ''"
            />

            <p v-if="field.hint" :id="`${formId}-${field.key}-hint`" class="admin-settings__hint">{{ field.hint }}</p>

            <p :id="`${formId}-${field.key}-error`" role="status" class="admin-settings__error">{{ errors[field.error] }}</p>

            <ElevationPrompt v-if="prompting === field.key" @elevated="close" @cancel="close" />
          </div>
        </div>

        <FieldRow :heading="strings.admin.settings.triageHeading" class="admin-settings__triage">
          <div v-for="id in triageIds" :key="id" class="admin-settings__triage-row">
            <label :for="`${formId}-triage-${id}`" class="admin-settings__triage-id">{{ id }}<Icon v-if="locked" name="lock" :size="12" class="admin-settings__lock" /></label>

            <div class="admin-settings__field">
              <input
                :id="`${formId}-triage-${id}`"
                v-model="draft.triageLabels[id]"
                :name="`triage-${id}`"
                class="admin-settings__input"
                autocomplete="off"
                :readonly="locked"
                :aria-disabled="locked ? 'true' : undefined"
                :aria-invalid="Boolean(errors[`triageLabels.${id}`])"
                :aria-describedby="`${formId}-triage-${id}-error`"
                v-on="lockedControl(`triage-${id}`)"
                @input="errors[`triageLabels.${id}`] = ''"
              />

              <p :id="`${formId}-triage-${id}-error`" role="status" class="admin-settings__error">{{ errors[`triageLabels.${id}`] }}</p>

              <ElevationPrompt v-if="prompting === `triage-${id}`" @elevated="close" @cancel="close" />
            </div>
          </div>
        </FieldRow>
      </div>

      <div class="admin-settings__actions">
        <AdminAction :label="saving ? strings.admin.settings.saving : strings.admin.settings.save" type="submit" variant="primary" />

        <p role="status" class="admin-settings__status" :class="{ 'admin-settings__status--failed': failed }">{{ status }}</p>
      </div>
    </form>
  </AdminSection>
</template>

<script setup lang="ts">
const instanceStore = useInstanceStore();
const admin = useAdminStore();
const { strings } = useStrings();
const formId = useId();
const draft = reactive({ projectName: '', singular: '', plural: '', triageLabels: {} as Record<string, string> });
const errors = ref<Record<string, string>>({});
const status = ref('');
const failed = ref(false);
const saving = ref(false);

const { locked, prompting, close, lockedControl } = useElevationGate();

const triageIds = computed(() => Object.keys(instanceStore.instance?.triageLabels ?? {}));

const nameFields = computed(() => {
  const labels = strings.value.admin.settings;
  return [
    { key: 'projectName', error: 'projectName', label: labels.projectName, hint: '' },
    { key: 'singular', error: 'effortName.singular', label: labels.effortSingular, hint: '' },
    { key: 'plural', error: 'effortName.plural', label: labels.effortPlural, hint: labels.pluralHint },
  ] as const;
});

watch(() => instanceStore.instance, (instance) => {
  if (!instance) return;
  draft.projectName = instance.projectName;
  draft.singular = instance.effortName.singular;
  draft.plural = instance.effortName.plural;
  draft.triageLabels = { ...instance.triageLabels };
}, { immediate: true });

const showFailure = (failure: unknown) => {
  const field = apiErrorField(failure);
  failed.value = true;
  if (apiErrorCode(failure) === 'invalid' && field) errors.value = { [field]: apiErrorMessage(failure) };
  else status.value = strings.value.admin.settings.failed;
};

const save = async () => {
  if (locked.value || saving.value) return;
  saving.value = true;
  errors.value = {};
  status.value = '';
  failed.value = false;
  try {
    await admin.saveSettings({
      projectName: draft.projectName.trim(),
      effortName: { singular: draft.singular.trim(), plural: draft.plural.trim() || null },
      triageLabels: Object.fromEntries(Object.entries(draft.triageLabels).map(([id, label]) => [id, label.trim()])),
    });
    status.value = strings.value.admin.settings.saved;
  }
  catch (failure) {
    showFailure(failure);
  }
  finally {
    saving.value = false;
  }
};
</script>

<style lang="scss" scoped>
.admin-settings {
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: $space-4 $space-8;

    @include respond(sm) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__names &__field + &__field {
    margin-top: $space-2;
  }

  &__label {
    margin-bottom: $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__input {
    @include text-field;

    &:read-only {
      border-color: var(--color-rule);
      background: var(--color-surface-alt);
      color: var(--color-muted);
    }
  }

  &__lock {
    margin-left: $space-1;
  }

  &__hint {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;
    font-size: $font-size-meta;
  }

  &__triage {
    padding-top: 0;
  }

  &__triage-row {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
    align-items: baseline;
    gap: $space-3;

    & + & {
      margin-top: $space-1;
    }
  }

  &__triage-id {
    color: var(--color-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: $font-size-meta;
    overflow-wrap: anywhere;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2 $space-3;
    margin-top: $space-4;
  }

  &__status {
    margin: 0;
    color: var(--color-muted);

    &--failed {
      @include error-line;
    }
  }
}
</style>
