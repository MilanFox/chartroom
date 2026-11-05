<template>
  <AdminSection id="snapshots" :heading="heading" :intro="strings.admin.snapshots.intro">
    <div class="admin-snapshots__take">
      <AdminAction :id="`${baseId}-take`" :label="takeAction.busy ? strings.admin.snapshots.taking : strings.admin.snapshots.take" variant="primary" @run="take" />

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

                <AdminAction :id="`${baseId}-delete-${snapshot.name}`" :label="strings.admin.snapshots.delete" variant="danger" @run="confirm(snapshot.name)" />
              </td>
            </tr>

            <tr v-if="confirming === snapshot.name">
              <td colspan="4">
                <InlineConfirm
                  :message="format(snapshot.trigger === 'pre-migrate' ? strings.admin.snapshots.confirmDeletePreMigrate : strings.admin.snapshots.confirmDelete, { name: snapshot.name })"
                  :confirm-label="strings.admin.snapshots.delete"
                  :keep-label="strings.admin.snapshots.keep"
                  :error="deleteAction.error"
                  @confirm="remove(snapshot.name)"
                  @keep="keep(snapshot.name)"
                />
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
const takeAction = reactive(useAction());
const deleteAction = reactive(useAction());
const takeStatus = ref('');
const takeFailed = ref(false);

const heading = computed(() => {
  const section = strings.value.shell.adminSections.snapshots;
  if (!admin.snapshots) return section;
  const total = admin.snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);
  return format(strings.value.admin.snapshots.heading, { heading: section, total: formatFileSize(total) });
});

const { confirming, confirm, keep, focusById } = useInlineConfirm({ triggerPrefix: `${baseId}-delete-` });

watch(confirming, () => {
  deleteAction.error = '';
});

const explainTake = (failure: unknown) => {
  takeFailed.value = true;
  takeStatus.value = apiErrorMessage(failure) || strings.value.admin.snapshots.errors.failed;
  return '';
};

const take = async () => {
  takeStatus.value = '';
  takeFailed.value = false;
  if (await takeAction.run(() => admin.takeSnapshot(), explainTake)) takeStatus.value = strings.value.admin.snapshots.taken;
};

const remove = async (name: string) => {
  if (!await deleteAction.run(() => admin.deleteSnapshot(name), () => strings.value.admin.snapshots.errors.deleteFailed)) return;
  confirming.value = null;
  focusById(`${baseId}-take`);
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

  &__muted {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
