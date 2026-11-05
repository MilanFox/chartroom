<template>
  <div class="map-card">
    <article class="map-card__card" :aria-labelledby="titleId">
      <div class="map-card__top">
        <h3 :id="titleId" class="map-card__title">
          <span class="map-card__kind">{{ strings.issue.kinds.map }}</span>

          <span class="map-card__number">{{ format(strings.issue.number, { number: map.number }) }}</span>

          {{ map.title }}
        </h3>

        <StatePill :status="map.status" />

        <button
          type="button"
          class="map-card__open"
          aria-haspopup="dialog"
          :aria-label="format(strings.dashboard.map.openNamed, { number: map.number, title: map.title })"
          @click="emit('open', map.number)"
        >
          {{ strings.dashboard.map.open }}
        </button>
      </div>

      <p v-if="map.excerpt" class="map-card__excerpt">{{ map.excerpt }}</p>

      <p class="map-card__counts">{{ format(strings.dashboard.map.counts, { total: children.length, frontier, ...counts }) }}</p>
    </article>

    <DisclosureSection
      :expanded="disclosure.expanded.value"
      :level="3"
      :heading="format(strings.dashboard.map.list, { count: children.length })"
      @update:expanded="disclosure.toggle"
    >
      <div class="map-card__views" role="group" :aria-label="strings.dashboard.map.views.label">
        <button
          v-for="option in VIEW_OPTIONS"
          :key="option"
          type="button"
          class="map-card__view"
          :aria-pressed="view === option"
          @click="view = option"
        >
          {{ strings.dashboard.map.views[option] }}
        </button>
      </div>

      <DependencyGraph v-if="view === 'graph'" :issue="map" bare />

      <template v-else>
        <TicketFilters v-model="filter" class="map-card__filters" :search-label="format(strings.dashboard.map.list, { count: children.length })" />

        <ul v-if="decisions.length" class="map-card__rows" :aria-label="format(strings.dashboard.map.list, { count: children.length })">
          <li v-for="row in decisions" :key="row.number" class="map-card__row">
            <TicketRow :row="row" decision @open="emit('open', $event)" />
          </li>
        </ul>

        <p v-else class="map-card__empty">{{ strings.dashboard.map.empty }}</p>
      </template>
    </DisclosureSection>
  </div>
</template>

<script setup lang="ts">
import type { MapCardProps } from './MapCard.types';

const props = defineProps<MapCardProps>();

const emit = defineEmits<{ open: [number: number] }>();

const VIEW_OPTIONS = ['list', 'graph'] as const;

const { strings, format } = useStrings();
const titleId = useId();
const filter = ref({ ...DEFAULT_TICKET_FILTER });
const view = ref<(typeof VIEW_OPTIONS)[number]>('list');
const disclosure = useMapListDisclosure(props.map.number, () => props.map.state);

const children = computed(() => props.rows.filter(row => row.parent === props.map.number));
const counts = computed(() => countByStatus(children.value));
const decisions = computed(() => decisionTickets(props.map.number, props.rows, filter.value));
</script>

<style lang="scss" scoped>
.map-card {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__card {
    @include card;
    padding: $space-3 $space-4;
  }

  &__top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1 $space-2;
    margin: 0;
    font-size: $font-size-base;
    overflow-wrap: anywhere;
  }

  &__kind {
    @include kind-chip;
  }

  &__number {
    color: var(--color-muted);
    font-weight: 400;
  }

  &__open {
    @include button-secondary;
    margin-left: auto;
  }

  &__excerpt {
    display: -webkit-box;
    margin: $space-2 0 0;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  &__counts {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__views {
    display: inline-flex;
    margin-bottom: $space-2;
  }

  &__view {
    @include button-secondary;
    border-radius: 0;

    &:first-child {
      border-radius: $radius-control 0 0 $radius-control;
    }

    &:last-child {
      margin-left: -1px;
      border-radius: 0 $radius-control $radius-control 0;
    }

    &[aria-pressed='true'] {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }

  &__filters {
    margin-bottom: $space-2;
  }

  &__rows {
    margin: 0 (-$space-4);
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--color-rule);
  }

  &__row + &__row {
    border-top: 1px solid var(--color-rule);
  }

  &__empty {
    margin: 0;
    color: var(--color-muted);
  }
}
</style>
