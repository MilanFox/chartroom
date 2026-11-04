<template>
  <div class="effort-tags">
    <ul v-if="effort.labels.length" class="effort-tags__list" :aria-label="strings.dashboard.tags.label">
      <li v-for="tag in effort.labels" :key="tag" class="effort-tags__chip">
        {{ tag }}

        <button
          v-if="!session.isViewer"
          type="button"
          class="effort-tags__remove"
          :aria-label="format(strings.dashboard.tags.remove, { tag })"
          :disabled="action.busy"
          @click="remove(tag)"
        >
          <Icon name="close" :size="12" />
        </button>
      </li>
    </ul>

    <form v-if="!session.isViewer" class="effort-tags__add" novalidate @submit.prevent="add">
      <label :for="fieldId" class="effort-tags__hidden">{{ strings.dashboard.tags.new }}</label>

      <input
        :id="fieldId"
        v-model="newTag"
        class="effort-tags__field"
        autocomplete="off"
        :placeholder="strings.dashboard.tags.new"
        :aria-describedby="errorId"
      />

      <button type="submit" class="effort-tags__submit" :disabled="action.busy">{{ strings.dashboard.tags.add }}</button>
    </form>

    <p :id="errorId" class="effort-tags__error" aria-live="polite">{{ action.error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { EffortTagsProps } from './EffortTags.types';

const props = defineProps<EffortTagsProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const action = reactive(useAction());
const fieldId = useId();
const errorId = useId();
const newTag = ref('');

const failed = () => strings.value.issue.fields.failed;

const remove = (tag: string) => action.run(() => issuesStore.removeLabel(props.effort.number, tag), failed);

const add = async () => {
  const tag = newTag.value.trim();
  if (!tag) {
    action.error = strings.value.dashboard.tags.empty;
    return;
  }
  if (await action.run(() => issuesStore.addLabel(props.effort.number, tag), failed)) newTag.value = '';
};
</script>

<style lang="scss" scoped>
.effort-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-1 $space-2;

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__chip {
    @include kind-chip;
  }

  &__remove {
    display: inline-flex;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
  }

  &__add {
    display: flex;
    gap: $space-1;
  }

  &__field {
    @include text-field;
    width: 120px;
    height: 26px;
    padding: 0 $space-2;
    font-size: $font-size-meta;
  }

  &__submit {
    @include button-quiet;
  }

  &__hidden {
    @include visually-hidden;
  }

  &__error {
    @include error-line;
    flex-basis: 100%;
    margin: 0;

    &:empty {
      display: none;
    }
  }
}
</style>
