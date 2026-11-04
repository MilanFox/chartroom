<template>
  <div class="workbench-results" :aria-busy="loading || action.busy">
    <p v-if="filters.numbers.length" class="workbench-results__picked">
      {{ format(strings.workbench.picked, { count: filters.numbers.length }) }}

      <NuxtLink :to="{ path: ISSUES_PATH, query: workbench.queryForView(null) }" class="workbench-results__show-all">{{ strings.workbench.showAll }}</NuxtLink>
    </p>

    <p role="status" class="workbench-results__summary">{{ summary }}</p>

    <p v-if="failed" role="alert" class="workbench-results__error">{{ strings.workbench.loadFailed }}</p>

    <template v-else-if="workbench.rows.length">
      <div v-if="workbench.grouped" class="workbench-results__groups">
        <section v-for="group in groups" :key="group.key" class="workbench-results__group" :aria-labelledby="group.headingId">
          <div class="workbench-results__group-header">
            <h2 :id="group.headingId" class="workbench-results__group-title">
              <NuxtLink v-if="group.effort" :to="effortPath(group.effort)" class="workbench-results__effort-link">{{ group.effort.title }}</NuxtLink>

              <template v-else>{{ strings.workbench.noEffort }}</template>
            </h2>

            <span class="workbench-results__group-meta">{{ group.meta }}</span>
          </div>

          <ul class="workbench-results__rows">
            <li v-for="row in group.rows" :key="row.number" class="workbench-results__row">
              <IssueRow :row="row" :effort-title="group.effort?.title ?? null" />
            </li>
          </ul>
        </section>
      </div>

      <ul v-else class="workbench-results__rows workbench-results__rows--flat" :aria-label="strings.workbench.results">
        <li v-for="row in workbench.rows" :key="row.number" class="workbench-results__row">
          <IssueRow :row="row" :effort-title="effortTitleOf(row.effort)" />
        </li>
      </ul>
    </template>

    <p v-else-if="!loading" class="workbench-results__empty">{{ strings.workbench.empty }}</p>

    <div v-if="workbench.hasMore && !failed" class="workbench-results__more">
      <button type="button" class="workbench-results__load-more" :disabled="action.busy" @click="loadMore">
        {{ action.busy ? strings.workbench.loading : strings.workbench.loadMore }}
      </button>

      <p v-if="action.error" role="alert" class="workbench-results__error">{{ action.error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkbenchResultsProps } from './WorkbenchResults.types';

const props = defineProps<WorkbenchResultsProps>();

const workbench = useWorkbenchStore();
const effortsStore = useEffortsStore();
const { strings, format } = useStrings();
const idPrefix = useId();
const action = reactive(useAction());

const filters = computed(() => workbench.filters);

const effortsByNumber = computed(() => new Map(effortsStore.efforts.map(effort => [effort.number, effort])));

const effortTitleOf = (number: number | null) => (number === null ? null : effortsByNumber.value.get(number)?.title ?? null);

const groups = computed(() => groupByEffort(workbench.rows).map((group) => {
  const key = group.effort ?? 'none';
  const total = workbench.effortTotal(group.effort);
  const count = total === 1 ? strings.value.workbench.groupCountOne : format(strings.value.workbench.groupCount, { count: total });
  const meta = [count, format(strings.value.workbench.lastUpdate, { date: formatDate(group.lastUpdated) })];
  return {
    key,
    headingId: `${idPrefix}-group-${key}`,
    effort: group.effort === null ? null : effortsByNumber.value.get(group.effort) ?? { number: group.effort, title: format(strings.value.workbench.number, { number: group.effort }) },
    rows: group.rows,
    meta: meta.join(' · '),
  };
}));

const summary = computed(() => {
  if (props.loading) return strings.value.workbench.loading;
  const template = workbench.hasMore ? strings.value.workbench.loadedMore : strings.value.workbench.loaded;
  return format(template, { count: workbench.rows.length });
});

const loadMore = () => action.run(() => workbench.loadMore(), () => strings.value.workbench.loadMoreFailed);
</script>

<style lang="scss" scoped>
.workbench-results {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__picked,
  &__summary {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__show-all {
    color: var(--color-accent);
  }

  &__error {
    @include error-line;
    margin: 0;
  }

  &__groups {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__group {
    @include card;
    overflow: hidden;
  }

  &__group-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: $space-1 $space-2;
    padding: $space-2 $space-3;
    border-bottom: 1px solid var(--color-rule);
    background: var(--color-surface-alt);
  }

  &__group-title {
    margin: 0;
    font-size: $font-size-base;
    font-weight: 600;
  }

  &__effort-link {
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__group-meta {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__rows {
    margin: 0;
    padding: 0;
    list-style: none;

    &--flat {
      @include card;
      overflow: hidden;
    }
  }

  &__row + &__row {
    border-top: 1px solid var(--color-rule);
  }

  &__empty {
    @include card;
    margin: 0;
    padding: $space-6 $space-4;
    color: var(--color-muted);
    text-align: center;
  }

  &__more {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-2;
  }

  &__load-more {
    @include button-secondary;
  }
}
</style>
