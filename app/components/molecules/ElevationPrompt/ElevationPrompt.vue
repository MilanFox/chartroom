<template>
  <div role="group" class="elevation-prompt" :aria-labelledby="labelId" @keydown.esc.stop="emit('cancel')">
    <p class="elevation-prompt__heading">
      <label :id="labelId" :for="fieldId" class="elevation-prompt__label">{{ strings.admin.prompt.label }}</label>

      <span :id="hintId" class="elevation-prompt__hint">{{ strings.admin.prompt.hint }}</span>
    </p>

    <div class="elevation-prompt__row">
      <input
        :id="fieldId"
        ref="field"
        v-model="password"
        type="password"
        name="admin-password"
        autocomplete="current-password"
        class="elevation-prompt__field"
        :aria-invalid="Boolean(action.error)"
        :aria-describedby="`${hintId} ${errorId}`"
        @keydown.enter.prevent="submit"
      />

      <button type="button" class="elevation-prompt__elevate" @click="submit">{{ action.busy ? strings.admin.prompt.elevating : strings.admin.prompt.elevate }}</button>

      <button type="button" class="elevation-prompt__cancel" @click="emit('cancel')">{{ strings.admin.prompt.cancel }}</button>
    </div>

    <p :id="errorId" role="status" class="elevation-prompt__error">{{ action.error }}</p>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ elevated: [], cancel: [] }>();

const session = useSessionStore();
const { strings } = useStrings();
const labelId = useId();
const fieldId = useId();
const hintId = useId();
const errorId = useId();
const field = useTemplateRef<HTMLInputElement>('field');
const password = ref('');
const action = reactive(useAction());

onMounted(() => field.value?.focus());

const messageFor = (failure: unknown) => {
  const messages = strings.value.admin.prompt;
  const code = apiErrorCode(failure);
  if (code === 'unauthenticated') return messages.wrong;
  return code === 'rate-limited' ? messages.rateLimited : messages.failed;
};

const explain = (failure: unknown) => {
  password.value = '';
  field.value?.focus();
  return messageFor(failure);
};

const submit = async () => {
  if (await action.run(() => session.elevate(password.value), explain)) emit('elevated');
};
</script>

<style lang="scss" scoped>
.elevation-prompt {
  flex: 1 0 100%;
  grid-column: 1 / -1;
  margin: $space-2 0 0;
  padding: $space-3;
  border: 1px solid var(--color-rule);
  border-radius: $radius;
  background: var(--color-tint-blocked);

  &__heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: $space-2;
    margin: 0 0 $space-2;
  }

  &__label {
    font-weight: 600;
  }

  &__hint {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__field {
    @include text-field;
    flex: 1 1 180px;
    max-width: 280px;
  }

  &__elevate {
    @include button-primary;
  }

  &__cancel {
    @include button-quiet;
    height: $control-height;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;
  }
}
</style>
