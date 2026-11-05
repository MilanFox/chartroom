<template>
  <AdminSection id="efforts" :heading="strings.shell.adminSections.efforts" :intro="strings.admin.efforts.intro">
    <p :id="`${baseId}-status`" role="status" tabindex="-1" class="admin-efforts__status">{{ deletedStatus }}</p>

    <div v-if="admin.closedEfforts?.length" class="admin-efforts__scroll" role="region" tabindex="0" :aria-labelledby="`${baseId}-caption`">
      <table class="admin-efforts__table">
        <caption :id="`${baseId}-caption`" class="admin-efforts__caption">{{ strings.admin.efforts.caption }}</caption>

        <thead>
          <tr>
            <th scope="col">{{ strings.admin.efforts.effort }}</th>

            <th scope="col">{{ strings.admin.efforts.closed }}</th>

            <th scope="col">{{ strings.admin.efforts.lastActivity }}</th>

            <th scope="col">{{ strings.admin.efforts.contents }}</th>

            <th scope="col">{{ strings.admin.efforts.actions }}</th>
          </tr>
        </thead>

        <tbody>
          <template v-for="effort in admin.closedEfforts" :key="effort.number">
            <tr>
              <th scope="row" class="admin-efforts__effort">
                <span class="admin-efforts__title">#{{ effort.number }} {{ effort.title }}</span>{{ ' ' }}

                <span v-if="effort.name" class="admin-efforts__slug">{{ effort.name }}</span>
              </th>

              <td>{{ effort.closedAt ? formatDate(effort.closedAt) : '' }}</td>

              <td>{{ formatTimestamp(effort.lastActivityAt) }}</td>

              <td class="admin-efforts__contents">{{ contentsOf(effort) }}</td>

              <td>
                <AdminAction
                  :id="`${baseId}-delete-${effort.number}`"
                  :label="strings.admin.efforts.delete"
                  :aria-label="format(strings.admin.efforts.deleteNamed, { name: nameOf(effort) })"
                  variant="danger"
                  @run="confirm(String(effort.number))"
                />
              </td>
            </tr>

            <tr v-if="confirming === String(effort.number)">
              <td colspan="5">
                <InlineConfirm
                  :message="format(strings.admin.efforts.confirmDelete, { name: nameOf(effort), ...countsOf(effort) })"
                  :confirm-label="strings.admin.efforts.delete"
                  :keep-label="strings.admin.efforts.keep"
                  :error="deleteAction.error"
                  @confirm="remove(effort)"
                  @keep="keep(String(effort.number))"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p v-else-if="admin.closedEfforts" class="admin-efforts__muted">{{ strings.admin.efforts.empty }}</p>

    <p v-else class="admin-efforts__muted">{{ strings.admin.efforts.hidden }}</p>
  </AdminSection>
</template>

<script setup lang="ts">
import type { ClosedEffort, EffortContents } from '~/types/api';

const admin = useAdminStore();
const { strings, format } = useStrings();
const baseId = useId();
const deleteAction = reactive(useAction());
const deletedStatus = ref('');

const { confirming, confirm, keep, focusById } = useInlineConfirm({ triggerPrefix: `${baseId}-delete-` });

watch(confirming, () => {
  deleteAction.error = '';
});

const nameOf = (effort: ClosedEffort) => {
  const { named, namedWithoutSlug } = strings.value.admin.efforts;
  return format(effort.name ? named : namedWithoutSlug, { number: effort.number, title: effort.title, slug: effort.name ?? '' });
};

const countsOf = (effort: ClosedEffort) => {
  const labels = strings.value.admin.efforts.counts;
  const counted = (key: keyof EffortContents) => (effort.counts[key] === 1 ? labels[`${key}One`] : format(labels[key], { count: effort.counts[key] }));
  return { issues: counted('issues'), comments: counted('comments'), links: counted('links'), changes: counted('changes'), researchNotes: counted('researchNotes') };
};

const contentsOf = (effort: ClosedEffort) => format(strings.value.admin.efforts.summary, countsOf(effort));

const remove = async (effort: ClosedEffort) => {
  const name = nameOf(effort);
  deletedStatus.value = '';
  let snapshot = '';
  let vacuumed = true;
  const deleted = await deleteAction.run(async () => {
    ({ snapshot: { name: snapshot }, vacuumed } = await admin.deleteEffort(effort.number));
  }, failure => apiErrorMessage(failure) || strings.value.admin.efforts.errors.deleteFailed);
  if (!deleted) return;
  confirming.value = null;
  deletedStatus.value = format(vacuumed ? strings.value.admin.efforts.deleted : strings.value.admin.efforts.deletedUncompacted, { name, snapshot });
  focusById(`${baseId}-status`);
};
</script>

<style lang="scss" scoped>
.admin-efforts {
  &__status {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;

    &:not(:empty) {
      margin-bottom: $space-4;
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

  &__table &__effort {
    font-weight: 400;
    white-space: normal;
  }

  &__title {
    display: block;
  }

  &__slug {
    display: block;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__table &__contents {
    white-space: normal;
  }

  &__muted {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
