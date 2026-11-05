<template>
  <aside class="issue-fields" :aria-labelledby="headingId">
    <h2 :id="headingId" class="issue-fields__heading">{{ strings.issue.fields.heading }}</h2>

    <IssueLabels :issue="issue" />

    <IssueClaim :issue="issue" />

    <IssueParent v-if="issue.kind !== 'effort'" :issue="issue" />

    <IssueBlockers :issue="issue" />

    <FieldRow :heading="strings.issue.fields.blocks.heading">
      <ul v-if="issue.blocks.length" class="issue-fields__blocks">
        <li v-for="blocked in issue.blocks" :key="blocked.number">
          <NuxtLink :to="issuePath(blocked.number)" class="issue-fields__link">{{ format(strings.issue.number, { number: blocked.number }) }} {{ blocked.title }}</NuxtLink>
        </li>
      </ul>

      <p v-else class="issue-fields__none">{{ strings.issue.fields.none }}</p>
    </FieldRow>

    <FieldRow v-if="issue.ledTo.length" :heading="strings.issue.fields.ledTo.heading">
      <ul class="issue-fields__blocks">
        <li v-for="spec in issue.ledTo" :key="spec.number">
          <NuxtLink :to="issuePath(spec.number)" class="issue-fields__link">{{ spec.title }}</NuxtLink>
        </li>
      </ul>
    </FieldRow>

    <FieldRow v-if="issue.from" :heading="strings.issue.fields.from.heading">
      <NuxtLink :to="issuePath(issue.from.number)" class="issue-fields__link">{{ issue.from.title }}</NuxtLink>
    </FieldRow>

    <IssueLinks :issue="issue" />

    <IssueResearch :issue="issue" />
  </aside>
</template>

<script setup lang="ts">
import type { IssueFieldsProps } from './IssueFields.types';

defineProps<IssueFieldsProps>();

const { strings, format } = useStrings();
const headingId = useId();
</script>

<style lang="scss" scoped>
.issue-fields {
  @include card;
  padding: 0 $space-4;

  &__heading {
    @include visually-hidden;
  }

  &__blocks {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__link {
    color: var(--color-accent);
    text-decoration: none;
    overflow-wrap: anywhere;

    &:hover {
      text-decoration: underline;
    }
  }

  &__none {
    margin: 0;
    color: var(--color-muted);
  }
}
</style>
