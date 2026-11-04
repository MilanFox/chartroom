<template>
  <div class="effort-list">
    <div class="effort-list__toolbar">
      <label class="effort-list__search">
        <Icon name="search" class="effort-list__search-icon" />

        <span class="effort-list__hidden">{{ strings.efforts.search }}</span>

        <input v-model="view.query" type="search" class="effort-list__search-field" :placeholder="strings.efforts.searchPlaceholder" />
      </label>

      <div v-if="tags.length" role="group" class="effort-list__tags" :aria-label="strings.efforts.tags">
        <button
          v-for="tag in tags"
          :key="tag"
          type="button"
          class="effort-list__tag"
          :aria-pressed="view.tags.includes(tag)"
          @click="toggleTag(tag)"
        >
          <Icon v-if="view.tags.includes(tag)" name="check" :size="12" />{{ tag }}
        </button>
      </div>

      <label class="effort-list__closed">
        <input v-model="view.showClosed" type="checkbox" />
        {{ format(strings.efforts.showClosed, { count: closedCount }) }}
      </label>
    </div>

    <p role="status" class="effort-list__hidden">{{ format(strings.efforts.shown, { shown: visibleEfforts.length, total: efforts.length }) }}</p>

    <div v-if="visibleEfforts.length" class="effort-list__scroll" role="region" tabindex="0" :aria-labelledby="captionId">
      <table class="effort-list__table">
        <caption :id="captionId" class="effort-list__hidden">{{ strings.efforts.caption }}</caption>

        <thead>
          <tr>
            <th v-for="column in columns" :key="column.id" scope="col" :class="`effort-list__head effort-list__head--${column.id}`" :aria-sort="column.sortKey === view.sortKey ? view.sortDirection : undefined">
              <button v-if="column.sortKey" type="button" class="effort-list__sort" @click="sortBy(column.sortKey)">
                {{ column.label }}

                <Icon v-if="column.sortKey === view.sortKey" :name="view.sortDirection === 'ascending' ? 'arrow-up' : 'arrow-down'" :size="12" />
              </button>

              <template v-else>{{ column.label }}</template>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="effort in visibleEfforts" :key="effort.number" class="effort-list__row">
            <td class="effort-list__number">{{ format(strings.efforts.number, { number: effort.number }) }}</td>

            <td class="effort-list__name">
              <NuxtLink :to="effortPath(effort)" class="effort-list__link">{{ effort.title }}</NuxtLink>

              <span v-if="effort.name" class="effort-list__slug">{{ effort.name }}</span>
            </td>

            <td><span :class="`effort-list__state effort-list__state--${effort.status}`">{{ strings.states[effort.status] }}</span></td>

            <td>
              <span class="effort-list__chips">
                <span v-for="tag in effort.labels" :key="tag" class="effort-list__chip">{{ tag }}</span>
              </span>
            </td>

            <td class="effort-list__meta">{{ gistOf(effort) }}</td>

            <td class="effort-list__meta">{{ format(strings.efforts.holder, { slug: effort.createdBy }) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="effort-list__empty">{{ efforts.length ? strings.efforts.noMatches : strings.efforts.empty }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Effort } from '~/types/api';
import type { EffortSortKey } from '~/utils/effort-list';
import type { EffortListProps } from './EffortList.types';

const props = defineProps<EffortListProps>();

const { strings, format } = useStrings();
const captionId = useId();
const view = reactive({ ...DEFAULT_EFFORT_VIEW, tags: [] as string[] });

const tags = computed(() => tagsAcross(props.efforts));
const closedCount = computed(() => props.efforts.filter(effort => effort.state === 'closed').length);
const visibleEfforts = computed(() => effortsInView(props.efforts, view));

const columns = computed(() => {
  const labels = strings.value.efforts.columns;
  return [
    { id: 'number', label: labels.number, sortKey: 'number' },
    { id: 'name', label: labels.name, sortKey: 'title' },
    { id: 'state', label: labels.state, sortKey: 'status' },
    { id: 'tags', label: labels.tags, sortKey: null },
    { id: 'rollup', label: labels.rollup, sortKey: 'open' },
    { id: 'created-by', label: labels.createdBy, sortKey: 'createdBy' },
  ] satisfies { id: string, label: string, sortKey: EffortSortKey | null }[];
});

const sortBy = (sortKey: EffortSortKey) => {
  view.sortDirection = view.sortKey === sortKey && view.sortDirection === 'ascending' ? 'descending' : 'ascending';
  view.sortKey = sortKey;
};

const toggleTag = (tag: string) => {
  view.tags = view.tags.includes(tag) ? view.tags.filter(pressed => pressed !== tag) : [...view.tags, tag];
};

const gistOf = (effort: Effort) => {
  const gist = rollupGist(effort.statusRollup);
  const { open, frontier, tickets, separator } = strings.value.efforts.gist;
  return [
    format(open, { count: gist.open }),
    gist.frontier === null ? null : format(frontier, { count: gist.frontier }),
    gist.specTickets ? format(tickets, { closed: gist.closedTickets, total: gist.specTickets }) : null,
  ].filter(Boolean).join(separator);
};
</script>

<style lang="scss" scoped>
.effort-list {
  @include card;

  &__hidden {
    @include visually-hidden;
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2 $space-3;
    padding: $space-3;
    border-bottom: 1px solid var(--color-rule);
  }

  &__search {
    position: relative;
    flex: 1 1 240px;
    max-width: 320px;
  }

  &__search-icon {
    position: absolute;
    top: 50%;
    left: $space-2;
    color: var(--color-muted);
    transform: translateY(-50%);
  }

  &__search-field {
    @include text-field;
    width: 100%;
    padding: 0 $space-2 0 $space-6 + $space-1;

    &::placeholder {
      color: var(--color-muted);
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__tag {
    @include label-chip;
    border-color: var(--color-rule);
    cursor: pointer;

    &:hover {
      border-color: var(--color-muted);
    }

    &[aria-pressed='true'] {
      border-color: var(--color-accent);
      background: var(--color-tint-accent);
      color: var(--color-accent);
    }
  }

  &__closed {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
    margin-left: auto;
    color: var(--color-muted);
    font-size: $font-size-meta;
    white-space: nowrap;

    input {
      accent-color: var(--color-accent);
    }
  }

  &__scroll {
    overflow-x: auto;
  }

  &__table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
  }

  &__head {
    padding: $space-2 $space-3;
    border-bottom: 1px solid var(--color-rule);
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 500;
    text-align: left;
    white-space: nowrap;

    &--number {
      width: 56px;
    }
  }

  &__sort {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    border: none;
    border-radius: $radius-control;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:hover {
      color: var(--color-fg);
    }
  }

  &__row td {
    padding: $space-2 $space-3;
    border-bottom: 1px solid var(--color-rule);
    vertical-align: middle;
  }

  &__row:last-child td {
    border-bottom: none;
  }

  &__row:hover {
    background: var(--color-surface-alt);
  }

  &__number {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__name {
    min-width: 200px;
  }

  &__link {
    display: block;
    color: var(--color-fg);
    font-weight: 500;
    text-decoration: none;

    &:hover {
      color: var(--color-accent);
      text-decoration: underline;
    }
  }

  &__slug,
  &__meta {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__meta {
    white-space: nowrap;
  }

  @each $status in open, claimed, blocked, closed {
    &__state--#{$status} {
      @include state-pill($status);
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__chip {
    @include label-chip;
  }

  &__empty {
    margin: 0;
    padding: $space-6 $space-4;
    color: var(--color-muted);
    text-align: center;
  }
}
</style>
