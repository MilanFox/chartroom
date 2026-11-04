<template>
  <div class="ticket-row">
    <span class="ticket-row__number">{{ format(strings.dashboard.tickets.number, { number: row.number }) }}</span>

    <button type="button" class="ticket-row__title" aria-haspopup="dialog" @click="emit('open', row.number)">{{ row.title }}</button>

    <span class="ticket-row__meta">
      <span v-for="label in shownLabels" :key="label" class="ticket-row__label">{{ labelGroupsStore.displayLabelOf(label) }}</span>

      <span v-if="row.assignee" class="ticket-row__assignee">{{ format(strings.dashboard.tickets.holder, { slug: row.assignee }) }}</span>

      <span v-if="row.blockedBy.length" class="ticket-row__blockers">
        {{ strings.dashboard.tickets.blockedBy }}

        <span
          v-for="blocker in row.blockedBy"
          :key="blocker.number"
          class="ticket-row__blocker"
          :class="{ 'ticket-row__blocker--closed': !blocker.open }"
        >
          {{ format(blocker.open ? strings.dashboard.tickets.blockerOpen : strings.dashboard.tickets.blockerClosed, { number: blocker.number }) }}<span class="ticket-row__hidden">{{ blocker.open ? strings.dashboard.tickets.blockerOpenState : strings.dashboard.tickets.blockerClosedState }}</span>
        </span>
      </span>

      <StatePill :status="row.status" />

      <span v-if="!decision && !session.isViewer" class="ticket-row__actions">
        <button
          v-if="row.assignee"
          type="button"
          class="ticket-row__action"
          :disabled="action.busy"
          :aria-label="format(strings.dashboard.tickets.unclaimNamed, { number: row.number })"
          @click="run(() => issuesStore.unassign(row.number))"
        >
          {{ strings.dashboard.tickets.unclaim }}
        </button>

        <button
          v-else-if="row.state === 'open'"
          type="button"
          class="ticket-row__action"
          :disabled="action.busy"
          :aria-label="format(strings.dashboard.tickets.claimNamed, { number: row.number })"
          @click="run(() => issuesStore.claim(row.number))"
        >
          {{ strings.dashboard.tickets.claim }}
        </button>

        <button
          v-if="row.state === 'open'"
          type="button"
          class="ticket-row__action"
          :disabled="action.busy"
          :aria-label="format(strings.dashboard.tickets.closeNamed, { number: row.number })"
          @click="run(() => issuesStore.close(row.number, ''))"
        >
          {{ strings.dashboard.tickets.close }}
        </button>
      </span>
    </span>

    <p class="ticket-row__error" aria-live="polite">{{ action.error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { TicketRowProps } from './TicketRow.types';

const props = defineProps<TicketRowProps>();

const emit = defineEmits<{ open: [number: number] }>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
const action = reactive(useAction());

const shownLabels = computed(() => {
  if (!props.decision) return props.row.labels;
  const type = wayfinderTypeOf(props.row.labels);
  return type ? [type] : [];
});

const claimError = useClaimError();

const explain = (failure: unknown) => claimError(failure) ?? format(strings.value.dashboard.tickets.failed, { number: props.row.number });

const run = (write: () => Promise<unknown>) => action.run(write, explain);
</script>

<style lang="scss" scoped>
.ticket-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-1 $space-2;
  padding: $space-2 $space-3;

  &:hover {
    background: var(--color-surface-alt);
  }

  &__number {
    min-width: 40px;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  &__title {
    flex: 1 1 200px;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-fg);
    font: inherit;
    font-weight: 500;
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;

    &:hover {
      color: var(--color-accent);
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
      border-radius: $radius-control;
    }
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: $space-1 $space-2;
    margin-left: auto;
  }

  &__label {
    @include label-chip;
  }

  &__assignee,
  &__blockers {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__blockers {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
  }

  &__blocker {
    @include state-pill(blocked);
    border-color: var(--color-state-blocked);

    &--closed {
      @include state-pill(closed);
    }
  }

  &__hidden {
    @include visually-hidden;
  }

  &__actions {
    display: inline-flex;
    gap: $space-1;
  }

  &__action {
    @include button-quiet;
  }

  &__error {
    @include error-line;
    flex-basis: 100%;
    margin: 0;

    &:empty {
      display: none;
    }
  }
}
</style>
