<template>
  <a
    :href="issuePath(row.number)"
    class="graph-node"
    :class="[`graph-node--${row.status}`, { 'graph-node--marked': mark }]"
    :transform="`translate(${x},${y})`"
    :aria-label="format(strings.issue.graph.node, { number: row.number, title: row.title })"
    @click="follow"
  >
    <g :clip-path="`url(#${clipId})`">
      <rect class="graph-node__card" :width="width" :height="height" />

      <rect class="graph-node__bar" :width="BAR_WIDTH" :height="height" />
    </g>

    <rect
      class="graph-node__outline"
      :x="0.5"
      :y="0.5"
      :width="width - 1"
      :height="height - 1"
      :rx="RADIUS"
    />

    <text class="graph-node__top" :x="TEXT_X" y="19">
      <tspan class="graph-node__number">{{ format(strings.issue.graph.nodeNumber, { number: row.number }) }}</tspan>

      <tspan v-if="glyph" dx="4">{{ glyph }}</tspan>

      <tspan v-if="row.assignee" class="graph-node__holder" dx="6">{{ format(strings.issue.graph.holder, { slug: row.assignee }) }}</tspan>
    </text>

    <text class="graph-node__title" :x="TEXT_X" y="37">{{ truncatedTitle }}</text>

    <template v-if="mark">
      <rect
        class="graph-node__mark"
        :x="width - MARK_WIDTH - 6"
        y="6"
        :width="MARK_WIDTH"
        height="16"
        rx="4"
      />

      <text class="graph-node__mark-text" :x="width - MARK_WIDTH / 2 - 6" y="17.5" text-anchor="middle">{{ mark }}</text>
    </template>
  </a>
</template>

<script setup lang="ts">
import type { GraphNodeProps } from './GraphNode.types';

const props = defineProps<GraphNodeProps>();

const BAR_WIDTH = 4;
const RADIUS = 8;
const TEXT_X = 14;
const MARK_WIDTH = 64;
const TITLE_CHARACTERS = 25;

const { strings, format } = useStrings();

const truncatedTitle = computed(() => (props.row.title.length > TITLE_CHARACTERS ? `${props.row.title.slice(0, TITLE_CHARACTERS - 1).trimEnd()}…` : props.row.title));

const follow = (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateTo(issuePath(props.row.number));
};
</script>

<style lang="scss" scoped>
.graph-node {
  cursor: pointer;

  &__card {
    fill: var(--color-surface);
  }

  &__outline {
    fill: none;
    stroke: var(--color-rule);
    stroke-width: 1;
  }

  &__top,
  &__title {
    fill: var(--color-fg);
    font-size: $font-size-meta;
  }

  &__number {
    font-weight: 600;
  }

  &__holder {
    fill: var(--color-state-claimed);
    font-weight: 500;
  }

  &__mark {
    fill: var(--color-tint-frontier);
  }

  &__mark-text {
    fill: var(--color-frontier);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  @each $status in open, claimed, blocked, closed {
    &--#{$status} &__bar {
      fill: var(--color-state-#{$status});
    }
  }

  &--closed &__card {
    fill: var(--color-tint-closed);
  }

  &--closed &__top,
  &--closed &__title {
    fill: var(--color-muted);
  }

  &--closed &__bar,
  &--closed &__outline {
    opacity: 0.5;
  }

  &--marked &__outline {
    stroke: var(--color-frontier);
    stroke-width: 2.5;
  }

  &:hover &__card {
    fill: var(--color-surface-alt);
  }

  &:focus-visible {
    outline: none;
  }

  &:focus-visible &__outline {
    stroke: var(--color-accent);
    stroke-width: 3;
  }
}
</style>
