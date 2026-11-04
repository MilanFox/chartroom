<template>
  <form role="search" class="workbench-search" @submit.prevent="commitQuery">
    <label class="workbench-search__field">
      <Icon name="search" class="workbench-search__icon" />

      <span class="workbench-search__hidden">{{ strings.workbench.search }}</span>

      <input
        v-model="query"
        type="search"
        class="workbench-search__input"
        :placeholder="strings.workbench.searchPlaceholder"
        :disabled="picked"
        :aria-describedby="hintId"
        @input="commitQueryLater"
      />
    </label>

    <label class="workbench-search__closed">
      <input type="checkbox" :checked="workbench.filters.state === 'all'" :disabled="picked" @change="toggleClosed" />
      {{ strings.workbench.includeClosed }}
    </label>

    <p :id="hintId" class="workbench-search__hint">{{ strings.workbench.searchHint }}</p>
  </form>
</template>

<script setup lang="ts">
const SEARCH_DELAY_MS = 300;

const workbench = useWorkbenchStore();
const { strings } = useStrings();
const hintId = useId();
const query = ref(workbench.filters.q ?? '');
const picked = computed(() => workbench.filters.numbers.length > 0);

watch(() => workbench.filters.q, (q) => {
  if ((q ?? '') !== query.value.trim()) query.value = q ?? '';
});

const commitQuery = () => navigateTo({ path: ISSUES_PATH, query: workbench.queryWith({ q: query.value.trim() || null }) }, { replace: true });

const commitQueryLater = useDebounceFn(commitQuery, SEARCH_DELAY_MS);

const toggleClosed = (event: Event) => navigateTo({ path: ISSUES_PATH, query: workbench.queryWith({ state: (event.target as HTMLInputElement).checked ? 'all' : null }) });
</script>

<style lang="scss" scoped>
.workbench-search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-2 $space-3;

  &__hidden {
    @include visually-hidden;
  }

  &__field {
    position: relative;
    flex: 1 1 280px;
  }

  &__icon {
    position: absolute;
    top: 50%;
    left: $space-2;
    color: var(--color-muted);
    transform: translateY(-50%);
  }

  &__input {
    @include text-field;
    width: 100%;
    padding: 0 $space-2 0 $space-6 + $space-1;

    &::placeholder {
      color: var(--color-muted);
    }
  }

  &__hint {
    flex-basis: 100%;
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__closed {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
    white-space: nowrap;

    input {
      accent-color: var(--color-accent);
    }
  }
}
</style>
