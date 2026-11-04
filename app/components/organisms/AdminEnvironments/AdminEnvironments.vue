<template>
  <AdminSection id="environments" :heading="strings.shell.adminSections.environments" :intro="strings.admin.environments.intro">
    <ul v-if="groups.length" class="admin-environments__list">
      <li v-for="group in groups" :key="group.key" class="admin-environments__card">
        <div class="admin-environments__header">
          <h3 class="admin-environments__name">{{ group.name }}</h3>

          <a v-if="group.url && safeHref(group.url)" :href="safeHref(group.url)!" class="admin-environments__url" target="_blank" rel="noopener noreferrer">{{ group.url }}</a>

          <template v-if="group.environment">
            <AdminAction :id="`${baseId}-edit-${group.environment.id}`" :label="strings.admin.environments.edit" variant="quiet" class="admin-environments__push" @run="editing = group.environment.id" />

            <AdminAction :id="`${baseId}-delete-${group.key}`" :label="strings.admin.environments.delete" variant="danger" @run="confirm(group.key)" />
          </template>
        </div>

        <p v-if="group.notes" class="admin-environments__notes">{{ group.notes }}</p>

        <InlineConfirm
          v-if="group.environment && confirming === group.key"
          :message="format(strings.admin.environments.confirmDelete, { name: group.name })"
          :confirm-label="strings.admin.environments.delete"
          :keep-label="strings.admin.environments.keep"
          @confirm="removeEnvironment(group.environment.id)"
          @keep="keep(group.key)"
        />

        <EnvironmentForm v-if="group.environment && editing === group.environment.id" :environment="group.environment" @saved="editing = null" @cancel="stopEditing(group.environment.id)" />

        <ul v-if="group.pointers.length" class="admin-environments__pointers" :aria-label="format(strings.admin.environments.pointers, { name: group.name })">
          <li v-for="pointer in group.pointers" :key="pointer.id" class="admin-environments__pointer">
            <span class="admin-environments__account">
              <span class="admin-environments__label">{{ pointer.label }}</span>
              {{ pointer.accountName }}
            </span>

            <span class="admin-environments__where">{{ pointer.whereToFind }}</span>

            <LockedSelect
              :value="String(pointer.environment ?? '')"
              :label="format(strings.admin.environments.pointerEnvironment, { label: pointer.label })"
              @change="rebind(pointer, $event)"
            >
              <option value="">{{ strings.admin.environments.anyEnvironment }}</option>

              <option v-for="option in environmentsStore.environments" :key="option.id" :value="option.id">{{ option.name }}</option>
            </LockedSelect>

            <AdminAction :id="`${baseId}-delete-pointer-${pointer.id}`" :label="strings.admin.environments.delete" variant="danger" @run="confirm(`pointer-${pointer.id}`)" />

            <InlineConfirm
              v-if="confirming === `pointer-${pointer.id}`"
              class="admin-environments__confirm"
              :message="format(strings.admin.environments.confirmDeletePointer, { label: pointer.label })"
              :confirm-label="strings.admin.environments.delete"
              :keep-label="strings.admin.environments.keep"
              @confirm="removePointer(pointer.id)"
              @keep="keep(`pointer-${pointer.id}`)"
            />
          </li>
        </ul>

        <p v-else-if="environmentsStore.pointers" class="admin-environments__muted">{{ strings.admin.environments.noPointers }}</p>
      </li>
    </ul>

    <p v-else class="admin-environments__muted">{{ strings.admin.environments.empty }}</p>

    <p v-if="!environmentsStore.pointers" class="admin-environments__muted">{{ strings.admin.environments.pointersHidden }}</p>

    <p role="status" class="admin-environments__error">{{ error }}</p>

    <EnvironmentForm v-if="adding === 'environment'" @saved="adding = null" @cancel="stopAdding('environment')" />

    <PointerForm v-if="adding === 'pointer'" @saved="adding = null" @cancel="stopAdding('pointer')" />

    <div class="admin-environments__add">
      <AdminAction :id="`${baseId}-add-environment`" :label="strings.admin.environments.add" @run="adding = 'environment'" />

      <AdminAction :id="`${baseId}-add-pointer`" :label="strings.admin.environments.addPointer" @run="adding = 'pointer'" />
    </div>
  </AdminSection>
</template>

<script setup lang="ts">
import type { CredentialPointer } from '~/types/api';

const environmentsStore = useEnvironmentsStore();
const { strings, format } = useStrings();
const baseId = useId();
const editing = ref<number | null>(null);
const adding = ref<'environment' | 'pointer' | null>(null);
const error = ref('');

const { confirming, confirm, keep, focusById } = useInlineConfirm({ triggerPrefix: `${baseId}-delete-` });

const groups = computed(() => environmentGroups(environmentsStore.environments, environmentsStore.pointers ?? [], strings.value.admin.environments.anyEnvironment));

const stopEditing = (id: number) => {
  editing.value = null;
  focusById(`${baseId}-edit-${id}`);
};

const stopAdding = (kind: 'environment' | 'pointer') => {
  adding.value = null;
  focusById(`${baseId}-add-${kind}`);
};

const run = async (write: () => Promise<void>, message: string) => {
  error.value = '';
  try {
    await write();
    return true;
  }
  catch {
    error.value = message;
    return false;
  }
};

const removeEnvironment = async (id: number) => {
  if (!await run(() => environmentsStore.deleteEnvironment(id), strings.value.admin.environments.errors.deleteFailed)) return;
  confirming.value = null;
  focusById(`${baseId}-add-environment`);
};

const removePointer = async (id: number) => {
  if (!await run(() => environmentsStore.deletePointer(id), strings.value.admin.environments.errors.deleteFailed)) return;
  confirming.value = null;
  focusById(`${baseId}-add-pointer`);
};

const rebind = (pointer: CredentialPointer, environment: string) => {
  run(() => environmentsStore.updatePointer(pointer.id, { environment: environment ? Number(environment) : null }), strings.value.admin.environments.errors.failed);
};
</script>

<style lang="scss" scoped>
.admin-environments {
  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding: $space-3;
    border: 1px solid var(--color-rule);
    border-radius: $radius;
  }

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: $space-1 $space-2;
  }

  &__name {
    margin: 0;
    font-size: $font-size-base;
  }

  &__url {
    color: var(--color-accent);
    font-size: $font-size-meta;
    overflow-wrap: anywhere;
  }

  &__header :deep(.admin-environments__push) {
    margin-left: auto;
  }

  &__notes {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__pointers {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__pointer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    grid-auto-flow: row dense;
    gap: $space-1 $space-3;
    padding: $space-2 0;
    border-top: 1px dashed var(--color-rule);

    @include respond(sm) {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.5fr) minmax(0, 11rem) auto;
    }
  }

  &__account {
    display: flex;
    flex-direction: column;
    overflow-wrap: anywhere;
  }

  &__label {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__where,
  &__muted {
    color: var(--color-muted);
    font-size: $font-size-meta;
    overflow-wrap: anywhere;
  }

  &__muted {
    margin: $space-2 0 0;
  }

  &__confirm {
    grid-column: 1 / -1;
  }

  &__error {
    @include error-line;
    margin: $space-2 0 0;
  }

  &__add {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    margin-top: $space-3;
  }
}
</style>
