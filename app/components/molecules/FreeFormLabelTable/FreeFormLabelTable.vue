<template>
  <section class="free-form-label-table">
    <h3 :id="headingId" class="free-form-label-table__heading">{{ strings.admin.labels.freeFormHeading }}</h3>

    <div v-if="labels.length" class="free-form-label-table__scroll" role="region" tabindex="0" :aria-labelledby="headingId">
      <table class="free-form-label-table__table">
        <thead>
          <tr>
            <th scope="col">{{ strings.admin.labels.label }}</th>

            <th scope="col">{{ strings.admin.labels.issues }}</th>

            <th v-if="groups.length" scope="col">{{ strings.admin.labels.promote }}</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="freeForm in labels" :key="freeForm.label">
            <th scope="row" class="free-form-label-table__label">{{ freeForm.label }}</th>

            <td>{{ freeForm.count }}</td>

            <td v-if="groups.length">
              <LockedSelect :key="resets" :label="format(strings.admin.labels.promoteLabel, { label: freeForm.label })" value="" @change="promote(freeForm.label, $event)">
                <option value="">{{ strings.admin.labels.promote }}</option>

                <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.displayName }}</option>
              </LockedSelect>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="free-form-label-table__muted">{{ strings.admin.labels.freeFormEmpty }}</p>

    <p v-if="labels.length && !groups.length" class="free-form-label-table__muted">{{ strings.admin.labels.promoteHint }}</p>
  </section>
</template>

<script setup lang="ts">
import type { FreeFormLabelTableProps } from './FreeFormLabelTable.types';

defineProps<FreeFormLabelTableProps>();
const emit = defineEmits<{ promote: [label: string, groupId: string] }>();

const { strings, format } = useStrings();
const headingId = useId();
const resets = ref(0);

const promote = (label: string, groupId: string) => {
  resets.value++;
  emit('promote', label, groupId);
};
</script>

<style lang="scss" scoped>
.free-form-label-table {
  &__heading {
    margin: $space-6 0 $space-2;
    font-size: $font-size-base;
  }

  &__muted {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
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
    }

    thead th {
      color: var(--color-muted);
      font-size: $font-size-meta;
      font-weight: 600;
    }
  }

  &__label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: $font-size-meta;
    font-weight: 400;
  }
}
</style>
