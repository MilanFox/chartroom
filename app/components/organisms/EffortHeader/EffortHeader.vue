<template>
  <header class="effort-header">
    <div class="effort-header__title-row">
      <h1 class="effort-header__title">
        <span class="effort-header__number">{{ format(strings.dashboard.header.number, { number: effort.number }) }}</span>

        {{ effort.title }}
      </h1>

      <button
        v-if="!session.isViewer && !titleEditor.editing"
        ref="titleButton"
        type="button"
        class="effort-header__edit"
        :aria-label="strings.dashboard.header.editTitle"
        @click="titleEditor.open"
      >
        <Icon name="pencil" :size="14" />
      </button>

      <StatePill :status="effort.state" />

      <div v-if="!session.isViewer" class="effort-header__close">
        <button
          v-if="effort.state === 'closed'"
          type="button"
          class="effort-header__close-button"
          :disabled="action.busy"
          @click="reopen"
        >
          {{ strings.dashboard.header.reopen }}
        </button>

        <button
          v-else-if="!warning"
          ref="closeButton"
          type="button"
          class="effort-header__close-button"
          :disabled="action.busy"
          @click="requestClose"
        >
          {{ action.busy ? strings.dashboard.header.closing : strings.dashboard.header.close }}
        </button>
      </div>
    </div>

    <div v-if="warning" role="alert" class="effort-header__warning">
      <span>{{ openChildren === 1 ? strings.dashboard.header.closeWarningOne : format(strings.dashboard.header.closeWarning, { count: openChildren }) }}</span>

      <button ref="closeAnywayButton" type="button" class="effort-header__close-anyway" :disabled="action.busy" @click="close">{{ action.busy ? strings.dashboard.header.closing : strings.dashboard.header.closeAnyway }}</button>

      <button type="button" class="effort-header__keep" @click="keepOpen">{{ strings.dashboard.header.keepOpen }}</button>
    </div>

    <p class="effort-header__error" aria-live="polite">{{ action.error }}</p>

    <TextEditor
      v-if="titleEditor.editing"
      v-model="titleEditor.draft"
      class="effort-header__editor"
      :label="strings.dashboard.header.titleLabel"
      :saving="titleEditor.saving"
      :failed="titleEditor.failed"
      :conflict="titleEditor.conflict"
      @save="titleEditor.save"
      @cancel="titleEditor.cancel"
      @reload="titleEditor.reload"
    />

    <div class="effort-header__meta">
      <span class="effort-header__slug">{{ effort.name ? format(strings.dashboard.header.slug, { slug: effort.name }) : strings.dashboard.header.slugNone }}</span>

      <button
        v-if="!session.isViewer && !slugEditor.editing"
        ref="slugButton"
        type="button"
        class="effort-header__edit"
        :aria-label="strings.dashboard.header.editSlug"
        @click="slugEditor.open"
      >
        <Icon name="pencil" :size="12" />
      </button>

      <EffortTags :effort="effort" />

      <span class="effort-header__created">{{ format(strings.dashboard.header.createdBy, { holder: effort.createdBy }) }}</span>
    </div>

    <TextEditor
      v-if="slugEditor.editing"
      v-model="slugEditor.draft"
      class="effort-header__editor effort-header__editor--slug"
      :label="strings.dashboard.header.slugLabel"
      :saving="slugEditor.saving"
      :failed="slugEditor.failed"
      :failed-message="slugFailure"
      :conflict="slugEditor.conflict"
      @save="slugEditor.save"
      @cancel="slugEditor.cancel"
      @reload="slugEditor.reload"
    />
  </header>
</template>

<script setup lang="ts">
import type { EffortHeaderProps } from './EffortHeader.types';

const props = defineProps<EffortHeaderProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const titleEditor = reactive(useVersionedEditor(() => props.effort, 'title'));
const slugEditor = reactive(useVersionedEditor(() => props.effort, 'name'));
const action = reactive(useIssueAction());
const titleButton = useTemplateRef<HTMLButtonElement>('titleButton');
const slugButton = useTemplateRef<HTMLButtonElement>('slugButton');
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton');
const closeAnywayButton = useTemplateRef<HTMLButtonElement>('closeAnywayButton');
const warning = ref(false);

const slugFailure = computed(() => {
  const messages = strings.value.efforts.new.errors;
  const { failure } = slugEditor;
  if (apiErrorField(failure) !== 'name') return undefined;
  return apiErrorCode(failure) === 'conflict' ? messages.slugTaken : messages.slugShape;
});

const refocusAfter = (editing: () => boolean, button: () => HTMLButtonElement | null) => watch(editing, async (isEditing) => {
  if (isEditing) return;
  await nextTick();
  button()?.focus();
});

refocusAfter(() => titleEditor.editing, () => titleButton.value);
refocusAfter(() => slugEditor.editing, () => slugButton.value);

const failed = () => strings.value.issue.fields.failed;

const close = async () => {
  if (await action.run(() => issuesStore.close(props.effort.number, ''), failed)) warning.value = false;
};

const requestClose = async () => {
  if (!props.openChildren) {
    await close();
    return;
  }
  warning.value = true;
  await nextTick();
  closeAnywayButton.value?.focus();
};

const keepOpen = async () => {
  warning.value = false;
  await nextTick();
  closeButton.value?.focus();
};

const reopen = () => action.run(() => issuesStore.reopen(props.effort.number), failed);
</script>

<style lang="scss" scoped>
.effort-header {
  &__title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__title {
    margin: 0;
    overflow-wrap: anywhere;
  }

  &__number {
    color: var(--color-muted);
    font-weight: 400;
  }

  &__edit {
    @include button-quiet;
    flex: none;
    color: var(--color-muted);
  }

  &__close {
    margin-left: auto;
  }

  &__close-button,
  &__keep {
    @include button-secondary;
  }

  &__warning {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    margin-top: $space-2;
    padding: $space-2 $space-3;
    border-radius: $radius-control;
    background: var(--color-tint-blocked);
    color: var(--color-state-blocked);
    font-weight: 500;
  }

  &__close-anyway {
    @include button-primary;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;

    &:empty {
      display: none;
    }
  }

  &__editor {
    margin-top: $space-2;

    &--slug {
      @include respond(sm) {
        max-width: $sidebar-width;
      }
    }
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1 $space-2;
    margin-top: $space-2;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
