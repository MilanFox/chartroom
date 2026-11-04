<template>
  <section class="dashboard-tickets" :aria-labelledby="headingId">
    <h2 :id="headingId" class="dashboard-tickets__heading">{{ strings.dashboard.tickets.heading }}</h2>

    <div class="dashboard-tickets__card">
      <TicketFilters
        v-model="filter"
        class="dashboard-tickets__filters"
        :search-label="strings.dashboard.tickets.search"
        :labels="options.labels"
        :assignees="options.assignees"
      />

      <template v-for="group in groups" :key="group.key">
        <h3 v-if="group.labelled" :id="`${headingId}-${group.key}`" class="dashboard-tickets__group">
          {{ group.title }}<span v-if="group.meta" class="dashboard-tickets__group-meta">{{ group.meta }}</span>
        </h3>

        <ul class="dashboard-tickets__rows" :aria-labelledby="group.labelled ? `${headingId}-${group.key}` : headingId">
          <li v-for="row in group.rows" :key="row.number" class="dashboard-tickets__row">
            <TicketRow :row="row" @open="emit('open', $event)" />
          </li>
        </ul>
      </template>

      <p v-if="!groups.length" class="dashboard-tickets__empty">{{ hasTickets ? strings.dashboard.tickets.empty : strings.dashboard.tickets.none }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DashboardTicketsProps } from './DashboardTickets.types';

const props = defineProps<DashboardTicketsProps>();

const emit = defineEmits<{ open: [number: number] }>();

const instanceStore = useInstanceStore();
const { strings, format } = useStrings();
const headingId = useId();
const filter = ref({ ...DEFAULT_TICKET_FILTER });

const options = computed(() => ticketFilterOptions(props.effort, props.rows));
const hasTickets = computed(() => ticketGroups(props.effort, props.rows, DEFAULT_TICKET_FILTER).length > 0);

const triageMeta = computed(() => triageSummaryOf(props.effort.statusRollup.triage, instanceStore.instance?.triageLabels ?? {}, strings.value.dashboard.tiles).buckets);

const groups = computed(() => ticketGroups(props.effort, props.rows, filter.value).map(group => ({
  ...group,
  title: group.spec ? format(strings.value.dashboard.tickets.specGroup, { number: group.spec.number, title: group.spec.title }) : strings.value.dashboard.tickets.triageGroup,
  meta: group.spec || !triageMeta.value ? '' : format(strings.value.dashboard.tickets.groupMeta, { buckets: triageMeta.value }),
})));
</script>

<style lang="scss" scoped>
.dashboard-tickets {
  &__heading {
    margin: 0 0 $space-2;
    font-size: $font-size-h2;
  }

  &__card {
    @include card;
    overflow: hidden;
  }

  &__filters {
    padding: $space-2 $space-3;
    border-bottom: 1px solid var(--color-rule);
    background: var(--color-surface-alt);
  }

  &__group {
    margin: 0;
    padding: $space-1 $space-3;
    border-bottom: 1px solid var(--color-rule);
    background: var(--color-surface-alt);
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 600;
  }

  &__group-meta {
    margin-left: $space-1;
    font-weight: 400;
  }

  &__rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__row + &__row {
    border-top: 1px solid var(--color-rule);
  }

  &__rows + &__group,
  &__rows + &__rows {
    border-top: 1px solid var(--color-rule);
  }

  &__empty {
    margin: 0;
    padding: $space-4;
    color: var(--color-muted);
  }
}
</style>
