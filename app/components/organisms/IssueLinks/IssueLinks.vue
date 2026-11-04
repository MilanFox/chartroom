<template>
  <FieldRow :heading="strings.issue.fields.links.heading">
    <template #heading-extra>
      <span class="issue-links__count">{{ format(strings.issue.fields.links.count, { count: issue.links.length }) }}</span>
    </template>

    <ul v-if="issue.links.length" class="issue-links__list">
      <li v-for="link in issue.links" :key="link.id" class="issue-links__link">
        <LinkForm
          v-if="editingId === link.id"
          :heading="strings.issue.fields.links.editHeading"
          :submit-label="strings.issue.fields.links.save"
          :initial="{ role: link.role, type: link.type, url: link.url, title: link.title }"
          :with-url="false"
          cancellable
          :error="editError"
          @submit="save(link, $event)"
          @cancel="stopEditing(link)"
        />

        <template v-else>
          <span class="issue-links__chip">{{ strings.issue.fields.links.roles[link.role] }}</span>

          <span class="issue-links__chip">{{ strings.issue.fields.links.types[link.type] }}</span>

          <a v-if="safeHref(link.url)" :href="safeHref(link.url)!" class="issue-links__target" target="_blank" rel="noopener noreferrer">{{ link.title }}</a>

          <span v-else class="issue-links__target">{{ link.title }}</span>

          <span class="issue-links__meta">{{ format(strings.issue.fields.links.by, { holder: link.addedBy, date: formatDate(link.createdAt) }) }}</span>

          <ManualChip :origin="link.origin" />

          <span v-if="!session.isViewer" class="issue-links__actions">
            <button
              :ref="(element) => editButtons.set(link.id, element as HTMLButtonElement)"
              type="button"
              class="issue-links__action"
              :aria-label="format(strings.issue.fields.links.edit, { title: link.title })"
              @click="startEditing(link)"
            >
              <Icon name="pencil" :size="12" />
            </button>

            <button
              type="button"
              class="issue-links__action"
              :aria-label="format(strings.issue.fields.links.remove, { title: link.title })"
              @click="remove(link)"
            >
              <Icon name="close" :size="12" />
            </button>
          </span>
        </template>
      </li>
    </ul>

    <p v-else class="issue-links__none">{{ strings.issue.fields.none }}</p>

    <LinkForm
      v-if="!session.isViewer"
      ref="addForm"
      class="issue-links__add"
      :heading="strings.issue.fields.links.addHeading"
      :submit-label="strings.issue.fields.links.add"
      :error="addError"
      @submit="add"
    />

    <p class="issue-links__error" aria-live="polite">{{ action.error }}</p>
  </FieldRow>
</template>

<script setup lang="ts">
import type { IssueLink } from '~/types/api';
import type { LinkDraft } from '~/stores/issues';
import type { LinkFormProps } from '~/components/molecules/LinkForm/LinkForm.types';
import type { IssueLinksProps } from './IssueLinks.types';

const props = defineProps<IssueLinksProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const action = reactive(useAction());
const linkError = useLinkError();
const addForm = useTemplateRef<{ reset: () => void }>('addForm');
const editButtons = new Map<number, HTMLButtonElement | null>();
const editingId = ref<number | null>(null);
const addError = ref<LinkFormProps['error']>(null);
const editError = ref<LinkFormProps['error']>(null);

const add = async (draft: LinkDraft) => {
  addError.value = null;
  const added = await action.run(() => issuesStore.addLink(props.issue.number, draft), (failure) => {
    addError.value = linkError(failure);
    return '';
  });
  if (added) addForm.value?.reset();
};

const startEditing = (link: IssueLink) => {
  editError.value = null;
  editingId.value = link.id;
};

const stopEditing = async (link: IssueLink) => {
  editingId.value = null;
  await nextTick();
  editButtons.get(link.id)?.focus();
};

const save = async (link: IssueLink, { role, type, title }: LinkDraft) => {
  editError.value = null;
  const saved = await action.run(() => issuesStore.editLink(props.issue.number, link.id, { role, type, title }), (failure) => {
    editError.value = linkError(failure);
    return '';
  });
  if (saved) await stopEditing(link);
};

const remove = (link: IssueLink) => action.run(() => issuesStore.removeLink(props.issue.number, link.id), () => strings.value.issue.fields.failed);
</script>

<style lang="scss" scoped>
.issue-links {
  &__count {
    margin-left: $space-1;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__link {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1;
  }

  &__chip {
    @include label-chip;
  }

  &__target {
    color: var(--color-accent);
    overflow-wrap: anywhere;
  }

  &__meta {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__actions {
    display: inline-flex;
    gap: $space-1;
  }

  &__action {
    @include button-quiet;
    display: inline-flex;
    align-items: center;
    color: var(--color-muted);
  }

  &__none {
    margin: 0;
    color: var(--color-muted);
  }

  &__add {
    margin-top: $space-3;
    padding-top: $space-3;
    border-top: 1px dashed var(--color-rule);
  }

  &__error {
    @include error-line;
    margin: $space-1 0 0;

    &:empty {
      display: none;
    }
  }
}
</style>
