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
                <InlineConfirm
                  :message="format(strings.admin.holders.confirmRevoke, { slug: holder.slug })"
                  :confirm-label="strings.admin.holders.revoke"
                  :keep-label="strings.admin.holders.keep"
                  @confirm="revoke(holder.slug)"
                  @keep="keep(holder.slug)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p v-else-if="holdersStore.holders" class="admin-holders__muted">{{ strings.admin.holders.empty }}</p>

    <p v-else class="admin-holders__muted">{{ strings.admin.holders.hidden }}</p>

    <p role="status" class="admin-holders__error">{{ action.error }}</p>

    <form class="admin-holders__create" novalidate @submit.prevent="create">
      <LockedField v-model="displayName" name="displayName" :label="strings.admin.holders.displayNameOptional" />

      <LockedField
        :id="`${baseId}-slug`"
        v-model="slug"
        name="slug"
        :label="strings.admin.holders.slug"
        :hint="strings.admin.holders.slugHint"
        :error="slugError"
        autocapitalize="off"
        spellcheck="false"
        @input="slugError = ''"
      />

      <div class="admin-holders__submit">
        <AdminAction :label="action.busy ? strings.admin.holders.creating : strings.admin.holders.create" type="submit" variant="primary" />
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
const displayName = ref('');
const slug = useDerivedSlug(displayName);
const slugError = ref('');
const action = reactive(useAction());

const { locked } = useElevationGate();

const { confirming, confirm, keep, focusById } = useInlineConfirm({ triggerPrefix: `${baseId}-revoke-` });

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

const failed = () => strings.value.admin.holders.errors.failed;

const rotate = (target: string) => action.run(async () => show(await holdersStore.rotateHolder(target)), failed);

const revoke = async (target: string) => {
  if (!await action.run(() => holdersStore.revokeHolder(target), failed)) return;
  confirming.value = null;
  focusById(`${baseId}-slug`);
};

const explainCreate = (failure: unknown) => {
  const messages = strings.value.admin.holders.errors;
  if (apiErrorField(failure) !== 'slug') return messages.failed;
  slugError.value = slugErrorOf(failure, { taken: messages.slugTaken, shape: messages.slugShape });
  focusById(`${baseId}-slug`);
  return '';
};

const create = async () => {
  if (locked.value) return;
  await action.run(async () => {
    slugError.value = '';
    const created = await holdersStore.createHolder({ slug: slug.value.trim(), displayName: displayName.value.trim() || null });
    slug.value = '';
    displayName.value = '';
    await show(created);
  }, explainCreate);
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

  &__submit {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    grid-column: 1 / -1;
  }
}
</style>
