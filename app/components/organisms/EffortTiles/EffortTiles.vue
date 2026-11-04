<template>
  <ul class="effort-tiles" :aria-label="strings.dashboard.tiles.label">
    <li v-for="tile in tiles" :key="tile.key" class="effort-tiles__tile">
      <p class="effort-tiles__title">{{ tile.title }}</p>

      <p class="effort-tiles__value" :aria-hidden="tile.summary ? 'true' : undefined">{{ tile.value }}</p>

      <p class="effort-tiles__detail" :aria-hidden="tile.summary ? 'true' : undefined">{{ tile.detail }}</p>

      <p v-if="tile.summary" class="effort-tiles__summary">{{ tile.summary }}</p>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { EffortTilesProps } from './EffortTiles.types';

interface Tile {
  key: string
  title: string
  value: string | number
  detail: string
  summary?: string
}

const props = defineProps<EffortTilesProps>();

const instanceStore = useInstanceStore();
const { strings, format } = useStrings();

const mapTile = (): Tile[] => {
  const { map } = props.effort;
  const rollup = props.effort.statusRollup.map;
  if (!map || !rollup) return [];
  const counts = countByStatus(props.rows.filter(row => row.parent === map.number));
  return [{
    key: 'map',
    title: format(strings.value.dashboard.tiles.map, { number: map.number }),
    value: strings.value.states[rollup.state],
    detail: format(strings.value.dashboard.tiles.mapDetail, { frontier: rollup.frontier, ...counts }),
  }];
};

const specTiles = (): Tile[] => props.effort.statusRollup.specs.map(({ number, tickets }) => {
  const counts = { ...EMPTY_STATUS_COUNTS, ...tickets };
  const title = props.effort.specs.find(spec => spec.number === number)?.title ?? '';
  return {
    key: `spec-${number}`,
    title: format(strings.value.dashboard.tiles.spec, { number, title }),
    value: format(strings.value.dashboard.tiles.specValue, counts),
    detail: strings.value.dashboard.tiles.specLegend,
    summary: format(strings.value.dashboard.tiles.specSummary, counts),
  };
});

const triageTile = (): Tile => {
  const labels = strings.value.dashboard.tiles;
  const { count, buckets } = triageSummaryOf(props.effort.statusRollup.triage, instanceStore.instance?.triageLabels ?? {}, labels);
  const detail = buckets || labels.triageNone;
  return { key: 'triage', title: labels.triage, value: count, detail, summary: format(labels.triageSummary, { count, buckets: detail }) };
};

const linksTile = (): Tile => {
  const labels = strings.value.dashboard.tiles;
  const { resource, artifact } = props.effort.linkRollup;
  const detail = format(labels.linksDetail, { resources: resource.length, artifacts: artifact.length });
  const count = resource.length + artifact.length;
  return { key: 'links', title: labels.links, value: count, detail, summary: format(labels.linksSummary, { count, detail }) };
};

const tiles = computed(() => [...mapTile(), ...specTiles(), triageTile(), linksTile()]);
</script>

<style lang="scss" scoped>
.effort-tiles {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: $space-3;
  margin: 0;
  padding: 0;
  list-style: none;

  @include respond(sm) {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  &__tile {
    @include card;
    padding: $space-3 $space-4;
  }

  &__title {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
    overflow-wrap: anywhere;
  }

  &__value {
    margin: 0;
    font-size: $font-size-big;
    font-weight: 600;
    line-height: $line-height-heading;
  }

  &__detail {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__summary {
    @include visually-hidden;
  }
}
</style>
