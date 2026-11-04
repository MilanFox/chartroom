<template>
  <AdminSection id="holders" :heading="strings.shell.adminSections.holders" :intro="strings.admin.holders.intro">
    <div v-if="issued" ref="notice" tabindex="-1" class="admin-holders__secret" :aria-labelledby="`${baseId}-secret-heading`">
      <h3 :id="`${baseId}-secret-heading`" class="admin-holders__secret-heading">{{ format(strings.admin.holders.secretHeading, { slug: issued.slug }) }}</h3>

      <p class="admin-holders__secret-hint">{{ strings.admin.holders.secretHint }}</p>

      <code class="admin-holders__secret-value">{{ issued.secret }}</code>

      <div class="admin-holders__secret-actions">
        <button type="button" class="admin-holders__copy" @click="copySecret">{{ strings.admin.holders.copy }}</button>

        <button type="button" class="admin-holders__dismiss" @click="dismiss">{{ strings.admin.holders.dismiss }}</button>

        <p role="status" class="admin-holders__copied">{{ copyMessage }}</p>
      </div>
    </div>

    <div v-if="holdersStore.holders?.length" class="admin-holders__scroll" role="region" tabindex="0" :aria-labelledby="`${baseId}-caption`">
      <table class="admin-holders__table">
        <caption :id="`${baseId}-caption`" class="admin-holders__caption">{{ strings.admin.holders.roster }}</caption>

        <thead>
          <tr>
            <th scope="col">{{ strings.admin.holders.slug }}</th>

            <th scope="col">{{ strings.admin.holders.displayName }}</th>

            <th scope="col">{{ strings.admin.holders.created }}</th>

            <th scope="col">{{ strings.admin.holders.lastUsed }}</th>

            <th scope="col">{{ strings.admin.holders.status }}</th>

            <th scope="col">{{ strings.admin.holders.actions }}</th>
          </tr>
        </thead>

        <tbody>
          <template v-for="holder in holdersStore.holders" :key="holder.slug">
            <tr :class="{ 'admin-holders__row--revoked': holder.revoked }">
              <th scope="row" class="admin-holders__slug">{{ holder.slug }}</th>

              <td>{{ holder.displayName ?? strings.admin.holders.unknown }}</td>

              <td>{{ holder.createdAt ? formatDate(holder.createdAt) : strings.admin.holders.unknown }}</td>

              <td>{{ lastUsedOf(holder) }}</td>

              <td class="admin-holders__status">{{ holder.revoked ? strings.admin.holders.revoked : strings.admin.holders.active }}</td>

              <td class="admin-holders__actions">
                <template v-if="!holder.revoked">
                  <AdminAction :label="strings.admin.holders.rotate" variant="quiet" @run="rotate(holder.slug)" />

                  <AdminAction :id="`${baseId}-revoke-${holder.slug}`" :label="strings.admin.holders.revoke" variant="danger" @run="confirm(holder.slug)" />
                </template>
              </td>
            </tr>

            <tr v-if="confirming === holder.slug">
              <td colspan="6">
                <div role="group" class="admin-holders__confirm" :aria-labelledby="`${baseId}-confirm-${holder.slug}`">
                  <span :id="`${baseId}-confirm-${holder.slug}`">{{ format(strings.admin.holders.confirmRevoke, { slug: holder.slug }) }}</span>

                  <button :id="`${baseId}-confirm-button-${holder.slug}`" type="button" class="admin-holders__revoke" @click="revoke(holder.slug)">{{ strings.admin.holders.revoke }}</button>

                  <button type="button" class="admin-holders__keep" @click="keep(holder.slug)">{{ strings.admin.holders.keep }}</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p v-else-if="holdersStore.holders" class="admin-holders__muted">{{ strings.admin.holders.empty }}</p>

    <p v-else class="admin-holders__muted">{{ strings.admin.holders.hidden }}</p>

    <p role="status" class="admin-holders__error">{{ error }}</p>

    <form class="admin-holders__create" novalidate @submit.prevent="create">
      <div class="admin-holders__field">
        <label :for="`${baseId}-slug`" class="admin-holders__label">{{ strings.admin.holders.slug }}<Icon v-if="locked" name="lock" :size="12" class="admin-holders__lock" /></label>

        <input
          :id="`${baseId}-slug`"
          v-model="slug"
          name="slug"
          class="admin-holders__input"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :readonly="locked"
          :aria-disabled="locked ? 'true' : undefined"
          :aria-invalid="Boolean(slugError)"
          :aria-describedby="`${baseId}-slug-hint ${baseId}-slug-error`"
          v-on="lockedControl('slug')"
          @input="slugError = ''"
        />

        <p :id="`${baseId}-slug-hint`" class="admin-holders__hint">{{ strings.admin.holders.slugHint }}</p>

        <p :id="`${baseId}-slug-error`" role="status" class="admin-holders__error">{{ slugError }}</p>

        <ElevationPrompt v-if="prompting === 'slug'" @elevated="close" @cancel="close" />
      </div>

      <div class="admin-holders__field">
        <label :for="`${baseId}-display-name`" class="admin-holders__label">{{ strings.admin.holders.displayNameOptional }}<Icon v-if="locked" name="lock" :size="12" class="admin-holders__lock" /></label>

        <input
          :id="`${baseId}-display-name`"
          v-model="displayName"
          name="displayName"
          class="admin-holders__input"
          autocomplete="off"
          :readonly="locked"
          :aria-disabled="locked ? 'true' : undefined"
          v-on="lockedControl('displayName')"
        />

        <ElevationPrompt v-if="prompting === 'displayName'" @elevated="close" @cancel="close" />
      </div>

      <div class="admin-holders__submit">
        <AdminAction :label="creating ? strings.admin.holders.creating : strings.admin.holders.create" type="submit" variant="primary" />
      </div>
    </form>
  </AdminSection>
</template>

<script setup lang="ts">
import type { HolderSecret, RosterHolder } from '~/types/api';

const holdersStore = useHoldersStore();
const { strings, format } = useStrings();
const { copy } = useClipboard({ legacy: true });
const baseId = useId();
const notice = useTemplateRef<HTMLElement>('notice');
const issued = ref<HolderSecret | null>(null);
const copyMessage = ref('');
const error = ref('');
const slug = ref('');
const displayName = ref('');
const slugError = ref('');
const creating = ref(false);

const { locked, prompting, close, lockedControl } = useElevationGate();

const { confirming, confirm, keep, focusById } = useInlineConfirm({ baseId, triggerPrefix: `${baseId}-revoke-` });

const lastUsedOf = (holder: RosterHolder) => {
  if (holder.lastUsedAt === undefined) return strings.value.admin.holders.unknown;
  return holder.lastUsedAt ? formatTimestamp(holder.lastUsedAt) : strings.value.admin.holders.never;
};

const show = async (secret: HolderSecret) => {
  issued.value = secret;
  copyMessage.value = '';
  await nextTick();
  notice.value?.focus();
};

const dismiss = () => {
  issued.value = null;
  focusById(`${baseId}-slug`);
};

const copySecret = async () => {
  try {
    await copy(issued.value!.secret);
    copyMessage.value = strings.value.admin.holders.copied;
  }
  catch {
    copyMessage.value = strings.value.admin.holders.copyFailed;
  }
};

const rotate = async (target: string) => {
  error.value = '';
  try {
    await show(await holdersStore.rotateHolder(target));
  }
  catch {
    error.value = strings.value.admin.holders.errors.failed;
  }
};

const revoke = async (target: string) => {
  error.value = '';
  try {
    await holdersStore.revokeHolder(target);
    confirming.value = null;
    focusById(`${baseId}-slug`);
  }
  catch {
    error.value = strings.value.admin.holders.errors.failed;
  }
};

const create = async () => {
  if (locked.value || creating.value) return;
  creating.value = true;
  slugError.value = '';
  error.value = '';
  try {
    const created = await holdersStore.createHolder({ slug: slug.value.trim(), displayName: displayName.value.trim() || null });
    slug.value = '';
    displayName.value = '';
    await show(created);
  }
  catch (failure) {
    const messages = strings.value.admin.holders.errors;
    if (apiErrorField(failure) === 'slug') {
      slugError.value = apiErrorCode(failure) === 'conflict' ? messages.slugTaken : messages.slugShape;
      focusById(`${baseId}-slug`);
    }
    else {
      error.value = messages.failed;
    }
  }
  finally {
    creating.value = false;
  }
};
</script>

<style lang="scss" scoped>
.admin-holders {
  &__secret {
    margin-bottom: $space-4;
    padding: $space-3;
    border: 1px solid var(--color-state-open);
    border-radius: $radius;
    background: var(--color-tint-open);
    outline: none;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__secret-heading {
    margin: 0;
    font-size: $font-size-base;
  }

  &__secret-hint {
    margin: $space-1 0 $space-2;
    font-size: $font-size-meta;
  }

  &__secret-value {
    display: block;
    padding: $space-2;
    border-radius: $radius-control;
    background: var(--color-surface);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow-wrap: anywhere;
    user-select: all;
  }

  &__secret-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    margin-top: $space-2;
  }

  &__copy {
    @include button-primary;
  }

  &__dismiss {
    @include button-secondary;
  }

  &__copied {
    margin: 0;
    font-size: $font-size-meta;
  }

  &__scroll {
    overflow-x: auto;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__table {
    width: 100%;
    border-collapse: collapse;

    th,
    td {
      padding: $space-2;
      border-bottom: 1px solid var(--color-rule);
      text-align: left;
      vertical-align: top;
      white-space: nowrap;
    }

    thead th {
      color: var(--color-muted);
      font-size: $font-size-meta;
      font-weight: 600;
    }
  }

  &__caption {
    @include visually-hidden;
  }

  &__slug {
    font-weight: 600;
  }

  &__row--revoked > :not(:last-child) {
    color: var(--color-muted);
    text-decoration: line-through;
  }

  &__row--revoked &__status {
    text-decoration: none;
  }

  &__table &__actions {
    white-space: normal;
  }

  &__confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-3;
    border-radius: $radius-control;
    background: var(--color-tint-blocked);
    white-space: normal;
  }

  &__revoke {
    @include button-secondary;
    color: var(--color-state-blocked);
  }

  &__keep {
    @include button-quiet;
    height: $control-height;
  }

  &__muted {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;
    font-size: $font-size-meta;
  }

  &__create {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: $space-2 $space-3;
    margin-top: $space-4;

    @include respond(sm) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
  }

  &__label {
    margin-bottom: $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__input {
    @include text-field;

    &:read-only {
      border-color: var(--color-rule);
      background: var(--color-surface-alt);
      color: var(--color-muted);
    }
  }

  &__lock {
    margin-left: $space-1;
  }

  &__hint {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__submit {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    grid-column: 1 / -1;
  }
}
</style>
