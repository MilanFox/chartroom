<template>
  <div class="change-row">
    <p class="change-row__line">
      <span class="change-row__actor">{{ group.actor }}</span>

      <template v-for="(edit, index) in edits" :key="index">
        <span class="change-row__separator" aria-hidden="true">{{ strings.issue.changes.separator }}</span>

        <span v-if="researchParts[index]" class="change-row__phrase">{{ researchParts[index].prefix }}<NuxtLink :to="researchParts[index].to" class="change-row__link">{{ researchParts[index].slug }}</NuxtLink>{{ researchParts[index].suffix }}</span>

        <span v-else class="change-row__phrase">{{ phraseOf(edit) }}</span>

        <button
          v-if="isTextField(edit.field)"
          type="button"
          class="change-row__expander"
          :aria-expanded="expanded.has(index)"
          @click="toggle(index)"
        >
          {{ expanded.has(index) ? strings.issue.changes.hideDiff : strings.issue.changes.showDiff }}
        </button>
      </template>

      <span class="change-row__separator" aria-hidden="true">{{ strings.issue.changes.separator }}</span>

      <time class="change-row__time" :datetime="group.at">{{ formatTimestamp(group.at) }}</time>

      <ManualChip :origin="group.origin" />
    </p>

    <template v-for="(edit, index) in edits" :key="index">
      <div
        v-if="isTextField(edit.field) && expanded.has(index)"
        role="region"
        :aria-label="format(strings.issue.changes.diffOf, { field: strings.issue.changes.fields[edit.field] })"
      >
        <LineDiff :before="edit.before ?? ''" :after="edit.after ?? ''" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { FieldEdit } from '~/utils/changes';
import type { ChangeRowProps } from './ChangeRow.types';

const props = defineProps<ChangeRowProps>();

const { strings, format } = useStrings();
const expanded = reactive(new Set<number>());

const edits = computed(() => groupEdits(props.group));

const SLUG_SLOT = '{slug}';

const researchPartsOf = ({ field, before, after }: FieldEdit) => {
  const note = field === 'research' ? researchNoteValue(after) : null;
  if (!note) return null;
  const { phrases } = strings.value.issue.changes;
  const previous = researchNoteValue(before);
  const phrase = previous
    ? format(phrases.researchUpdated, { slug: SLUG_SLOT, before: formatFileSize(previous.size), after: formatFileSize(note.size) })
    : format(phrases.researchAdded, { slug: SLUG_SLOT, size: formatFileSize(note.size) });
  const [prefix = '', suffix = ''] = phrase.split(SLUG_SLOT);
  return { prefix, suffix, slug: note.slug, to: researchNotePath(props.group.changes[0]!.issue, note.slug) };
};

const researchParts = computed(() => edits.value.map(researchPartsOf));

const toggle = (index: number) => {
  if (!expanded.delete(index)) expanded.add(index);
};

const phraseOf = ({ field, before, after }: FieldEdit) => {
  const { phrases } = strings.value.issue.changes;
  switch (field) {
    case 'title':
    case 'body':
    case 'name':
    case 'testInstructions':
      return phrases[field];
    case 'state':
      return after === 'closed' ? phrases.closed : phrases.reopened;
    case 'assignee':
      return after ? phrases.claimed : phrases.unclaimed;
    case 'parent':
      if (before && after) return format(phrases.parentMoved, { before, after });
      return after ? format(phrases.parentSet, { number: after }) : format(phrases.parentRemoved, { number: before ?? '' });
    case 'label':
      return after ? format(phrases.labelAdded, { label: after }) : format(phrases.labelRemoved, { label: before ?? '' });
    case 'blocker':
      return after ? format(phrases.blockerAdded, { blocker: blockerLabel(after) }) : format(phrases.blockerRemoved, { blocker: blockerLabel(before ?? '') });
    case 'link':
      return after ? format(phrases.linkAdded, { title: linkTitle(after) }) : format(phrases.linkRemoved, { title: linkTitle(before ?? '') });
    case 'comment':
      return phrases.commentDeleted;
    default:
      return field;
  }
};
</script>

<style lang="scss" scoped>
.change-row {
  padding: $space-2 0;
  font-size: $font-size-meta;
  color: var(--color-muted);

  &__line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1 0;
    margin: 0;
  }

  &__actor {
    font-weight: 600;
    color: var(--color-fg);
  }

  &__link {
    color: inherit;
  }

  &__expander {
    @include button-quiet;
    margin-left: $space-1;
  }
}
</style>
