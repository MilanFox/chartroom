<template>
  <DisclosureSection :heading="strings.dashboard.changes.heading" :meta="format(strings.dashboard.changes.count, { count: changes.length })">
    <ol v-if="groups.length" class="effort-changes">
      <li v-for="group in groups" :key="group.id" class="effort-changes__row">
        <ChangeRow :group="group" />
      </li>
    </ol>

    <p v-else class="effort-changes__empty">{{ strings.dashboard.changes.empty }}</p>
  </DisclosureSection>
</template>

<script setup lang="ts">
import type { EffortChangesProps } from './EffortChanges.types';

const props = defineProps<EffortChangesProps>();

const { strings, format } = useStrings();
const changes = useIssueChanges(() => props.effort);

const groups = computed(() => changeGroups(changes.value));
</script>

<style lang="scss" scoped>
.effort-changes {
  margin: 0;
  padding: 0;
  list-style: none;

  &__row + &__row {
    border-top: 1px solid var(--color-rule);
  }

  &__empty {
    margin: 0;
    color: var(--color-muted);
  }
}
</style>
