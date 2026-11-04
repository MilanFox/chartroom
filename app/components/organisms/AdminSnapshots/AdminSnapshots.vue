<template>
  <AdminSection id="snapshots" :heading="strings.shell.adminSections.snapshots" :intro="strings.admin.snapshots.intro">
    <div class="admin-snapshots__take">
      <AdminAction :id="`${baseId}-take`" :label="taking ? strings.admin.snapshots.taking : strings.admin.snapshots.take" variant="primary" @run="take" />

      <p role="status" class="admin-snapshots__status" :class="{ 'admin-snapshots__status--failed': takeFailed }">{{ takeStatus }}</p>
    </div>

    <div v-if="admin.snapshots?.length" class="admin-snapshots__scroll" role="region" tabindex="0" :aria-labelledby="`${baseId}-caption`">
      <table class="admin-snapshots__table">
        <caption :id="`${baseId}-caption`" class="admin-snapshots__caption">{{ strings.admin.snapshots.caption }}</caption>

        <thead>
          <tr>
            <th scope="col">{{ strings.admin.snapshots.trigger }}</th>

            <th scope="col">{{ strings.admin.snapshots.time }}</th>

            <th scope="col">{{ strings.admin.snapshots.size }}</th>

            <th scope="col">{{ strings.admin.snapshots.actions }}</th>
          </tr>
        </thead>

        <tbody>
          <template v-for="snapshot in admin.snapshots" :key="snapshot.name">
            <tr>
              <td>{{ strings.admin.snapshots.triggers[snapshot.trigger] }}</td>

              <th scope="row" class="admin-snapshots__time">{{ formatTimestamp(snapshot.takenAt) }}</th>

              <td>{{ formatFileSize(snapshot.size) }}</td>

              <td class="admin-snapshots__actions">
                <a :href="`/ui/snapshots/${encodeURIComponent(snapshot.name)}`" :download="`${snapshot.name}.sqlite`" class="admin-snapshots__download">{{ strings.admin.snapshots.download }}</a>

                <AdminAction v-if="snapshot.trigger === 'manual'" :id="`${baseId}-delete-${snapshot.name}`" :label="strings.admin.snapshots.delete" variant="danger" @run="confirm(snapshot.name)" />
              </td>
            </tr>

            <tr v-if="confirming === snapshot.name">
              <td colspan="4">
                <div role="group" class="admin-snapshots__confirm" :aria-labelledby="`${baseId}-confirm-${snapshot.name}`">
                  <span :id="`${baseId}-confirm-${snapshot.name}`">{{ format(strings.admin.snapshots.confirmDelete, { name: snapshot.name }) }}</span>

                  <button :id="`${baseId}-confirm-button-${snapshot.name}`" type="button" class="admin-snapshots__delete" @click="remove(snapshot.name)">{{ strings.admin.snapshots.delete }}</button>

                  <button type="button" class="admin-snapshots__keep" @click="keep(snapshot.name)">{{ strings.admin.snapshots.keep }}</button>

                  <p role="status" class="admin-snapshots__error">{{ deleteError }}</p>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p v-else-if="admin.snapshots" class="admin-snapshots__muted">{{ strings.admin.snapshots.empty }}</p>

    <p v-else class="admin-snapshots__muted">{{ strings.admin.snapshots.hidden }}</p>
  </AdminSection>
</template>

<script setup lang="ts">
const admin = useAdminStore();
const { strings, format } = useStrings();
const baseId = useId();
const taking = ref(false);
const takeStatus = ref('');
const takeFailed = ref(false);
const deleteError = ref('');

const { confirming, confirm, keep, focusById } = useInlineConfirm({ baseId, triggerPrefix: `${baseId}-delete-` });

watch(confirming, () => {
  deleteError.value = '';
});

const take = async () => {
  if (taking.value) return;
  taking.value = true;
  takeStatus.value = '';
  takeFailed.value = false;
  try {
    await admin.takeSnapshot();
    takeStatus.value = strings.value.admin.snapshots.taken;
  }
  catch (failure) {
    takeFailed.value = true;
    takeStatus.value = apiErrorMessage(failure) || strings.value.admin.snapshots.errors.failed;
  }
  finally {
    taking.value = false;
  }
};

const remove = async (name: string) => {
  deleteError.value = '';
  try {
    await admin.deleteSnapshot(name);
    confirming.value = null;
    focusById(`${baseId}-take`);
  }
  catch {
    deleteError.value = strings.value.admin.snapshots.errors.deleteFailed;
  }
};
</script>

<style lang="scss" scoped>
.admin-snapshots {
  &__take {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2 $space-3;
    margin-bottom: $space-4;
  }

  &__status {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;

    &--failed {
      @include error-line;
    }
  }

  &__scroll {
    overflow-x: auto;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__table {
    width: 100%;
    border-collapse: collapse;

    th,
    td {
      padding: $space-2;
      border-bottom: 1px solid var(--color-rule);
      text-align: left;
      vertical-align: top;
      white-space: nowrap;
    }

    thead th {
      color: var(--color-muted);
      font-size: $font-size-meta;
      font-weight: 600;
    }
  }

  &__caption {
    @include visually-hidden;
  }

  &__time {
    font-weight: 400;
  }

  &__table &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    white-space: normal;
  }

  &__download {
    @include button-quiet;
    display: inline-flex;
    align-items: center;
    height: $control-height;
  }

  &__confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-3;
    border-radius: $radius-control;
    background: var(--color-tint-blocked);
    white-space: normal;
  }

  &__delete {
    @include button-secondary;
    color: var(--color-state-blocked);
  }

  &__keep {
    @include button-quiet;
    height: $control-height;
  }

  &__muted {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__error {
    @include error-line;
    flex-basis: 100%;
    margin: 0;
    font-size: $font-size-meta;

    &:empty {
      display: none;
    }
  }
}
</style>
