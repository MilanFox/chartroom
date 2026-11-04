<template>
  <dialog
    ref="sheet"
    role="dialog"
    aria-modal="true"
    class="issue-drawer"
    :aria-label="issue ? format(strings.dashboard.drawer.label, { number: issue.number, title: issue.title }) : strings.dashboard.drawer.loading"
    @close="onClose"
    @click="onSheetClick"
  >
    <div class="issue-drawer__bar">
      <NuxtLink v-if="number" :to="issuePath(number)" class="issue-drawer__page">{{ strings.dashboard.drawer.openPage }}</NuxtLink>

      <button type="button" class="issue-drawer__close" :aria-label="strings.dashboard.drawer.close" @click="hide">
        <Icon name="close" />
      </button>
    </div>

    <Suspense v-if="issue">
      <div class="issue-drawer__body">
        <IssueHeader :issue="issue" />

        <IssueBody :issue="issue" />

        <IssueFields :issue="issue" class="issue-drawer__fields" />

        <IssueThread :issue="issue" />

        <IssueCloseForm :issue="issue" />
      </div>
    </Suspense>

    <p v-else-if="failed" role="alert" class="issue-drawer__status">{{ format(strings.dashboard.drawer.failed, { number: number ?? '' }) }}</p>

    <p v-else class="issue-drawer__status">{{ strings.dashboard.drawer.loading }}</p>
  </dialog>
</template>

<script setup lang="ts">
import type { IssueDrawerProps } from './IssueDrawer.types';

const props = defineProps<IssueDrawerProps>();

const emit = defineEmits<{ close: [] }>();

const issuesStore = useIssuesStore();
const { strings, format } = useStrings();
const sheet = useTemplateRef<HTMLDialogElement>('sheet');
const failed = ref(false);
let opener: HTMLElement | null = null;

const issue = computed(() => (props.number === null ? null : issuesStore.documents[props.number] ?? null));

watch(() => props.number, async (number) => {
  if (number === null) return;
  opener = document.activeElement as HTMLElement | null;
  failed.value = false;
  if (!sheet.value?.open) sheet.value?.showModal();
  try {
    await issuesStore.load(number);
  }
  catch {
    failed.value = true;
  }
});

const hide = () => sheet.value?.close();

const onClose = () => {
  emit('close');
  opener?.focus();
  opener = null;
};

const onSheetClick = (event: MouseEvent) => {
  if (event.target === sheet.value) hide();
};
</script>

<style lang="scss" scoped>
.issue-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  width: min(560px, 100vw);
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: none;
  border-left: 1px solid var(--color-rule);
  background: var(--color-bg);
  color: var(--color-fg);
  box-shadow: var(--shadow-card);

  &::backdrop {
    background: var(--color-scrim);
  }

  &__bar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
    padding: $space-2 $space-4;
    border-bottom: 1px solid var(--color-rule);
    background: var(--color-surface);
  }

  &__page {
    color: var(--color-accent);
    font-size: $font-size-meta;
  }

  &__close {
    @include button-secondary;
    display: inline-flex;
    align-items: center;
    padding: 0 $space-2;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    padding: $space-4;
  }

  &__fields {
    align-self: stretch;
  }

  &__status {
    margin: 0;
    padding: $space-4;
    color: var(--color-muted);
  }
}
</style>
