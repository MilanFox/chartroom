<template>
  <component
    :is="bare ? 'div' : DisclosureSection"
    class="dependency-graph"
    v-bind="bare ? {} : { 'heading': strings.issue.graph.heading, 'expanded': disclosure.expanded.value, 'onUpdate:expanded': disclosure.toggle }"
  >
    <template v-if="rows?.length" #meta>
      <span class="dependency-graph__progress">{{ progressText }}</span>

      <span class="dependency-graph__bar" aria-hidden="true">
        <span
          v-for="status in BAR_ORDER"
          :key="status"
          :class="`dependency-graph__segment dependency-graph__segment--${status}`"
          :style="{ width: `${(progress[status] / progress.total) * 100}%` }"
        />
      </span>
    </template>

    <p v-if="failed" role="alert" class="dependency-graph__note">{{ strings.issue.graph.loadFailed }}</p>

    <p v-else-if="!rows" class="dependency-graph__note">{{ strings.issue.graph.loading }}</p>

    <p v-else-if="!rows.length" class="dependency-graph__note">{{ strings.issue.graph.empty }}</p>

    <template v-else>
      <div class="dependency-graph__toolbar">
        <button type="button" role="switch" class="dependency-graph__toggle" :aria-checked="disclosure.hideClosed.value" @click="disclosure.hideClosed.value = !disclosure.hideClosed.value">
          {{ format(strings.issue.graph.hideClosed, { count: progress.closed }) }}
        </button>
      </div>

      <p v-if="!shownRows.length" class="dependency-graph__note">{{ strings.issue.graph.allClosedHidden }}</p>

      <div v-else class="dependency-graph__scroller">
        <svg
          class="dependency-graph__canvas"
          role="group"
          :aria-label="format(strings.issue.graph.graphLabel, { number: issue.number })"
          :width="layout.width"
          :height="layout.height"
          :viewBox="`0 0 ${layout.width} ${layout.height}`"
        >
          <defs>
            <clipPath :id="clipId">
              <rect :width="layout.nodeWidth" :height="layout.nodeHeight" rx="8" />
            </clipPath>

            <marker
              v-for="marker in ['rest', 'highlight']"
              :id="`${arrowId}-${marker}`"
              :key="marker"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" :class="`dependency-graph__arrow dependency-graph__arrow--${marker}`" />
            </marker>
          </defs>

          <g aria-hidden="true">
            <path
              v-for="edge in layout.edges"
              :key="`${edge.from}-${edge.to}`"
              class="dependency-graph__edge"
              :class="{ 'dependency-graph__edge--open': openBlockers.has(edge.from), 'dependency-graph__edge--highlight': edge.to === highlighted }"
              :d="edge.path"
              :marker-end="`url(#${arrowId}-${edge.to === highlighted ? 'highlight' : 'rest'})`"
            />
          </g>

          <GraphNode
            v-for="node in nodes"
            :key="node.row.number"
            :row="node.row"
            :x="node.x"
            :y="node.y"
            :width="layout.nodeWidth"
            :height="layout.nodeHeight"
            :clip-id="clipId"
            :glyph="glyphOf(node.row)"
            :mark="takeable.has(node.row.number) ? mark : null"
            :blockers="node.blockers"
            @mouseenter="highlighted = node.row.number"
            @mouseleave="highlighted = null"
            @focus="highlighted = node.row.number"
            @blur="highlighted = null"
          />
        </svg>
      </div>
    </template>
  </component>
</template>

<script setup lang="ts">
import type { IssueRow, IssueStatus } from '~/types/api';
import DisclosureSection from '~/components/molecules/DisclosureSection/DisclosureSection.vue';
import type { DependencyGraphProps } from './DependencyGraph.types';

const props = defineProps<DependencyGraphProps>();

const BAR_ORDER: IssueStatus[] = ['closed', 'claimed', 'blocked', 'open'];

const { strings, format } = useStrings();
const clipId = useId();
const arrowId = useId();
const highlighted = ref<number | null>(null);
const disclosure = useGraphDisclosure(() => props.issue);
const { rows, failed } = await useIssueChildren(() => props.issue);

const progress = computed(() => graphProgress(rows.value ?? []));
const takeable = computed(() => new Set(progress.value.takeable));
const mark = computed(() => strings.value.issue.graph.marks[props.issue.kind === 'map' ? 'map' : 'spec']);
const progressText = computed(() => format(strings.value.issue.graph.progress, { ...progress.value, takeable: progress.value.takeable.length, mark: mark.value }));

const shownRows = computed(() => (rows.value ?? []).filter(row => !disclosure.hideClosed.value || row.state === 'open'));
const openBlockers = computed(() => new Set(shownRows.value.filter(row => row.state === 'open').map(row => row.number)));
const layout = computed(() => layoutGraph(shownRows.value.map(row => ({ number: row.number, blockedBy: row.blockedBy.map(blocker => blocker.number) }))));
const nodes = computed(() => {
  const rowOf = new Map(shownRows.value.map(row => [row.number, row]));
  return layout.value.columns.flat().flatMap(slot => (slot.ticket === null ? [] : [{ row: rowOf.get(slot.ticket)!, x: slot.x, y: slot.y, blockers: layout.value.edges.filter(edge => edge.to === slot.ticket && openBlockers.value.has(edge.from)).map(edge => edge.from) }]));
});

const glyphOf = (row: IssueRow) => {
  if (props.issue.kind !== 'map') return null;
  const type = wayfinderTypeOf(row.labels);
  return type ? (strings.value.issue.graph.glyphs as Record<string, string>)[type] ?? null : null;
};
</script>

<style lang="scss" scoped>
.dependency-graph {
  &__progress {
    margin-left: auto;
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 400;
  }

  &__bar {
    display: flex;
    flex: none;
    width: 120px;
    height: 6px;
    overflow: hidden;
    border-radius: $radius-pill;
    background: var(--color-surface-alt);
  }

  @each $status in open, claimed, blocked, closed {
    &__segment--#{$status} {
      background: var(--color-state-#{$status});
    }
  }

  &__segment--closed {
    opacity: 0.5;
  }

  &__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: $space-2;
  }

  &__toggle {
    @include button-quiet;
    font-weight: 400;

    &::before {
      display: inline-block;
      width: $space-3;
      margin-right: $space-1;
      content: '\2610';
    }

    &[aria-checked='true']::before {
      content: '\2611';
    }
  }

  &__scroller {
    overflow-x: auto;
  }

  &__canvas {
    display: block;
  }

  &__edge {
    fill: none;
    stroke: var(--color-edge);
    stroke-width: 1.5;

    &--open {
      stroke: var(--color-state-blocked);
      opacity: 0.6;
    }

    &--highlight {
      stroke: var(--color-accent);
      stroke-width: 2.5;
      opacity: 1;
    }
  }

  &__arrow {
    &--rest {
      fill: var(--color-edge);
    }

    &--highlight {
      fill: var(--color-accent);
    }
  }

  &__note {
    margin: 0;
    color: var(--color-muted);
  }
}
</style>
