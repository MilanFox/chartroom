<template>
  <form class="link-form" novalidate :aria-labelledby="headingId" @submit.prevent="submit" @keydown.esc="cancellable && emit('cancel')">
    <h4 :id="headingId" class="link-form__heading">{{ heading }}</h4>

    <label :for="`${fieldId}-role`" class="link-form__label">{{ strings.issue.fields.links.role }}</label>

    <select :id="`${fieldId}-role`" v-model="draft.role" class="link-form__field">
      <option v-for="role in LINK_ROLES" :key="role" :value="role">{{ strings.issue.fields.links.roles[role] }}</option>
    </select>

    <label :for="`${fieldId}-type`" class="link-form__label">{{ strings.issue.fields.links.type }}</label>

    <select :id="`${fieldId}-type`" v-model="draft.type" class="link-form__field">
      <option v-for="type in LINK_TYPES" :key="type" :value="type">{{ strings.issue.fields.links.types[type] }}</option>
    </select>

    <template v-if="withUrl">
      <label :for="`${fieldId}-url`" class="link-form__label">{{ strings.issue.fields.links.url }}</label>

      <input
        :id="`${fieldId}-url`"
        v-model="draft.url"
        type="url"
        class="link-form__field"
        autocomplete="off"
        :aria-invalid="error?.field === 'url'"
        :aria-describedby="errorId"
      />
    </template>

    <label :for="`${fieldId}-title`" class="link-form__label">{{ strings.issue.fields.links.title }}</label>

    <input
      :id="`${fieldId}-title`"
      v-model="draft.title"
      class="link-form__field"
      autocomplete="off"
      :aria-invalid="error?.field === 'title'"
      :aria-describedby="errorId"
    />

    <p :id="errorId" class="link-form__error" aria-live="polite">{{ error?.message }}</p>

    <div class="link-form__actions">
      <button type="submit" class="link-form__submit">{{ submitLabel }}</button>

      <button v-if="cancellable" type="button" class="link-form__cancel" @click="emit('cancel')">{{ strings.issue.fields.links.cancel }}</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { LinkDraft } from '~/stores/issues';
import type { LinkFormProps } from './LinkForm.types';

const props = withDefaults(defineProps<LinkFormProps>(), { initial: undefined, withUrl: true, cancellable: false, error: null });

const emit = defineEmits<{ submit: [draft: LinkDraft], cancel: [] }>();

const LINK_ROLES = ['resource', 'artifact'] as const;
const LINK_TYPES = ['branch', 'file', 'preview', 'doc', 'external'] as const;
const BLANK_LINK: LinkDraft = { role: 'resource', type: 'branch', url: '', title: '' };

const { strings } = useStrings();
const headingId = useId();
const fieldId = useId();
const errorId = useId();
const draft = reactive<LinkDraft>({ ...(props.initial ?? BLANK_LINK) });

const submit = () => emit('submit', { ...draft, url: draft.url.trim(), title: draft.title.trim() });

const reset = () => Object.assign(draft, BLANK_LINK);

defineExpose({ reset });
</script>

<style lang="scss" scoped>
.link-form {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__heading {
    margin: 0 0 $space-1;
    font-size: $font-size-base;
    font-weight: 600;
  }

  &__label {
    font-size: $font-size-meta;
    color: var(--color-muted);
  }

  &__field {
    @include text-field;
    width: 100%;
  }

  &__error {
    @include error-line;
    margin: 0;

    &:empty {
      display: none;
    }
  }

  &__actions {
    display: flex;
    gap: $space-2;
    margin-top: $space-1;
  }

  &__submit {
    @include button-secondary;
    flex: 1;
  }

  &__cancel {
    @include button-secondary;
  }
}
</style>
