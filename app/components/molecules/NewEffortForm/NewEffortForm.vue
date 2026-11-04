<template>
  <form class="new-effort" novalidate :aria-labelledby="headingId" @submit.prevent="submit" @keydown.esc="emit('cancel')">
    <h2 :id="headingId" class="new-effort__heading">{{ strings.efforts.new.heading }}</h2>

    <div class="new-effort__fields">
      <div class="new-effort__field">
        <label :for="titleId" class="new-effort__label">{{ strings.efforts.new.title }}</label>

        <input
          :id="titleId"
          ref="titleField"
          v-model="title"
          name="title"
          class="new-effort__input"
          autocomplete="off"
          :aria-invalid="Boolean(errors.title)"
          :aria-describedby="titleErrorId"
        />

        <p :id="titleErrorId" class="new-effort__error">{{ errors.title }}</p>
      </div>

      <div class="new-effort__field">
        <label :for="slugId" class="new-effort__label">{{ strings.efforts.new.slug }}</label>

        <input
          :id="slugId"
          ref="slugField"
          v-model="slug"
          name="slug"
          class="new-effort__input"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :aria-invalid="Boolean(errors.slug)"
          :aria-describedby="`${slugHintId} ${slugErrorId}`"
        />

        <p :id="slugHintId" class="new-effort__hint">{{ strings.efforts.new.slugHint }}</p>

        <p :id="slugErrorId" class="new-effort__error">{{ errors.slug }}</p>
      </div>
    </div>

    <p class="new-effort__error" aria-live="polite">{{ action.error }}</p>

    <div class="new-effort__actions">
      <button type="submit" class="new-effort__create">{{ action.busy ? strings.efforts.new.creating : strings.efforts.new.create }}</button>

      <button type="button" class="new-effort__cancel" @click="emit('cancel')">{{ strings.efforts.new.cancel }}</button>
    </div>
  </form>
</template>

<script setup lang="ts">
const emit = defineEmits<{ created: [number: number], cancel: [] }>();

const effortsStore = useEffortsStore();
const { strings } = useStrings();
const headingId = useId();
const titleId = useId();
const titleErrorId = useId();
const slugId = useId();
const slugHintId = useId();
const slugErrorId = useId();
const titleField = useTemplateRef<HTMLInputElement>('titleField');
const slugField = useTemplateRef<HTMLInputElement>('slugField');
const title = ref('');
const slug = ref('');
const errors = reactive({ title: '', slug: '' });
const action = reactive(useAction());

onMounted(() => titleField.value?.focus());

const explain = (failure: unknown) => {
  const messages = strings.value.efforts.new.errors;
  const field = apiErrorField(failure);
  if (field === 'title') {
    errors.title = messages.title;
    titleField.value?.focus();
  }
  else if (field === 'name') {
    errors.slug = slugErrorOf(failure, { taken: messages.slugTaken, shape: messages.slugShape });
    slugField.value?.focus();
  }
  else {
    return messages.unknown;
  }
  return '';
};

const submit = async () => {
  await action.run(async () => {
    errors.title = '';
    errors.slug = '';
    emit('created', await effortsStore.create({ title: title.value.trim(), name: slug.value.trim() || null }));
  }, explain);
};
</script>

<style lang="scss" scoped>
.new-effort {
  @include card;
  margin-bottom: $space-4;
  padding: $space-4;

  &__heading {
    margin: 0 0 $space-3;
  }

  &__fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0 $space-4;
  }

  &__field {
    display: flex;
    flex-direction: column;
  }

  &__label {
    margin-bottom: $space-1;
    font-weight: 600;
  }

  &__input {
    @include text-field;
  }

  &__hint {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;
  }

  &__actions {
    display: flex;
    gap: $space-2;
    margin-top: $space-3;
  }

  &__create {
    @include button-primary;
  }

  &__cancel {
    @include button-secondary;
  }
}
</style>
