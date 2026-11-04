<template>
  <AdminSection id="settings" :heading="strings.shell.adminSections.settings" :intro="strings.admin.settings.intro">
    <form class="admin-settings" novalidate @submit.prevent="save">
      <div class="admin-settings__grid">
        <div class="admin-settings__names">
          <LockedField
            v-for="field in nameFields"
            :key="field.key"
            v-model="draft[field.key]"
            :name="field.key"
            :label="field.label"
            :hint="field.hint"
            :error="errors[field.error]"
            @input="errors[field.error] = ''"
          />
        </div>

        <FieldRow :heading="strings.admin.settings.triageHeading" class="admin-settings__triage">
          <LockedField
            v-for="id in triageIds"
            :key="id"
            v-model="draft.triageLabels[id]"
            :name="`triage-${id}`"
            :label="id"
            :error="errors[`triageLabels.${id}`]"
            inline
            @input="errors[`triageLabels.${id}`] = ''"
          />
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
const draft = reactive({ projectName: '', singular: '', plural: '', triageLabels: {} as Record<string, string> });
const errors = ref<Record<string, string>>({});
const status = ref('');
const failed = ref(false);
const saving = ref(false);

const { locked } = useElevationGate();

const triageIds = computed(() => Object.keys(instanceStore.instance?.triageLabels ?? {}));

const nameFields = computed(() => {
  const labels = strings.value.admin.settings;
  return [
    { key: 'projectName', error: 'projectName', label: labels.projectName, hint: '' },
    { key: 'singular', error: 'effortName.singular', label: labels.effortSingular, hint: labels.effortHint },
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

  &__names > * + * {
    margin-top: $space-2;
  }

  &__triage :deep(.locked-field + .locked-field) {
    margin-top: $space-1;
  }

  &__triage {
    padding-top: 0;
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
