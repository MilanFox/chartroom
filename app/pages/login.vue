<template>
  <main class="login">
    <form class="login__card" novalidate @submit.prevent="submit">
      <ChartroomLogo class="login__logo" />

      <h1>{{ strings.login.heading }}</h1>

      <label :for="fieldId" class="login__label">{{ strings.login.field }}</label>

      <p :id="hintId" class="login__hint">{{ strings.login.hint }}</p>

      <input
        :id="fieldId"
        v-model="secret"
        type="password"
        name="secret"
        autocomplete="current-password"
        class="login__field"
        :aria-invalid="Boolean(action.error)"
        :aria-describedby="`${hintId} ${errorId}`"
      />

      <p :id="errorId" class="login__error" aria-live="assertive">{{ action.error }}</p>

      <button type="submit" class="login__submit">{{ action.busy ? strings.login.submitting : strings.login.submit }}</button>
    </form>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

const session = useSessionStore();
const { strings } = useStrings();
const fieldId = useId();
const hintId = useId();
const errorId = useId();
const secret = ref('');
const action = reactive(useAction());

useHead(() => ({ title: strings.value.login.heading }));

const errorFor = (code: string | null) => {
  const { errors } = strings.value.login;
  return code && code in errors ? errors[code as keyof typeof errors] : errors.unknown;
};

const submit = async () => {
  if (!secret.value.trim()) {
    action.error = strings.value.login.errors.empty;
    return;
  }
  await action.run(async () => {
    await session.login(secret.value);
    await navigateTo(HOME_PATH);
  }, failure => errorFor(apiErrorCode(failure)));
};
</script>

<style lang="scss" scoped>
.login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: $space-4;

  &__card {
    @include card;
    display: flex;
    flex-direction: column;
    width: min(400px, 100%);
    padding: $space-6;
  }

  &__logo {
    margin-bottom: $space-4;
  }

  &__label {
    font-weight: 600;
  }

  &__hint {
    margin: $space-1 0 $space-2;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__field {
    @include text-field;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 1px;
    }
  }

  &__error {
    @include error-line;
    min-height: 1.5em;
    margin: $space-1 0 $space-3;
  }

  &__submit {
    @include button-primary;
    align-self: flex-start;
  }
}
</style>
