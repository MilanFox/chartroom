<template>
  <div class="ticket-filters">
    <label :for="`${idPrefix}-search`" class="ticket-filters__hidden">{{ searchLabel }}</label>

    <input
      :id="`${idPrefix}-search`"
      v-model="filter.query"
      type="search"
      class="ticket-filters__search"
      autocomplete="off"
      :placeholder="strings.dashboard.tickets.searchPlaceholder"
    />

    <div role="group" class="ticket-filters__states" :aria-label="strings.dashboard.tickets.states">
      <button
        v-for="status in STATUSES"
        :key="status"
        type="button"
        class="ticket-filters__state"
        :class="`ticket-filters__state--${status}`"
        :aria-pressed="filter.states.includes(status)"
        @click="toggleState(status)"
      >
        {{ strings.states[status] }}
      </button>
    </div>

    <template v-if="labels && assignees">
      <label :for="`${idPrefix}-label`" class="ticket-filters__hidden">{{ strings.dashboard.tickets.label }}</label>

      <select :id="`${idPrefix}-label`" v-model="filter.label" class="ticket-filters__select">
        <option :value="null">{{ strings.dashboard.tickets.anyLabel }}</option>

        <option v-for="label in labels" :key="label" :value="label">{{ labelGroupsStore.displayLabelOf(label) }}</option>
      </select>

      <label :for="`${idPrefix}-assignee`" class="ticket-filters__hidden">{{ strings.dashboard.tickets.assignee }}</label>

      <select :id="`${idPrefix}-assignee`" v-model="filter.assignee" class="ticket-filters__select">
        <option :value="null">{{ strings.dashboard.tickets.anyAssignee }}</option>

        <option :value="NO_ASSIGNEE">{{ strings.dashboard.tickets.unassigned }}</option>

        <option v-for="assignee in assignees" :key="assignee" :value="assignee">{{ format(strings.dashboard.tickets.holder, { slug: assignee }) }}</option>
      </select>

      <label :for="`${idPrefix}-sort`" class="ticket-filters__sort-label">{{ strings.dashboard.tickets.sort }}</label>

      <select :id="`${idPrefix}-sort`" v-model="filter.sort" class="ticket-filters__select">
        <option v-for="sort in SORTS" :key="sort" :value="sort">{{ strings.dashboard.tickets.sorts[sort] }}</option>
      </select>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { IssueStatus } from '~/types/api';
import type { TicketFilter, TicketSort } from '~/utils/dashboard';
import type { TicketFiltersProps } from './TicketFilters.types';

withDefaults(defineProps<TicketFiltersProps>(), { labels: undefined, assignees: undefined });

const filter = defineModel<TicketFilter>({ required: true });

const SORTS: TicketSort[] = ['number', 'state', 'title'];

const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
const idPrefix = useId();

const toggleState = (status: IssueStatus) => {
  const { states } = filter.value;
  filter.value.states = states.includes(status) ? states.filter(chosen => chosen !== status) : [...states, status];
};
</script>

<style lang="scss" scoped>
.ticket-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-2;

  &__search {
    @include text-field;
    flex: 1 1 180px;
    min-width: 0;
  }

  &__states {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__state {
    @include pill;
    border-color: var(--color-rule);
    cursor: pointer;

    @each $status in open, claimed, blocked, closed {
      &--#{$status}[aria-pressed='true'] {
        @include state-pill($status);
        border-color: var(--color-state-#{$status});
      }
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__select {
    @include text-field;
    padding: 0 $space-2;
  }

  &__sort-label {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__hidden {
    @include visually-hidden;
  }
}
</style>
