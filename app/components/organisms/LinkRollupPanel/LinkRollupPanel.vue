<template>
  <DisclosureSection
    :heading="strings.dashboard.links.heading"
    :meta="format(strings.dashboard.links.count, { resources: effort.linkRollup.resource.length, artifacts: effort.linkRollup.artifact.length })"
  >
    <div v-for="section in sections" :key="section.role" class="link-rollup__section">
      <div class="link-rollup__section-header">
        <h3 class="link-rollup__heading">{{ format(strings.dashboard.links.roles[section.role], { count: section.links.length }) }}</h3>

        <button v-if="section.role === 'artifact' && section.links.length" type="button" class="link-rollup__copy" @click="copyArtifacts">{{ strings.dashboard.links.copy }}</button>
      </div>

      <p v-if="section.role === 'artifact'" role="status" class="link-rollup__copied">{{ copyMessage }}</p>

      <ul v-if="section.links.length" class="link-rollup__list">
        <li v-for="link in section.links" :key="link.url" class="link-rollup__link">
          <span class="link-rollup__type">{{ strings.issue.fields.links.types[link.type] }}</span>

          <span class="link-rollup__target">
            <a v-if="safeHref(link.url)" :href="safeHref(link.url)!" class="link-rollup__title" target="_blank" rel="noopener noreferrer">{{ link.title }}</a>

            <span v-else class="link-rollup__title">{{ link.title }}</span>

            <span class="link-rollup__url">{{ link.url }}</span>
          </span>

          <span class="link-rollup__sources">{{ format(strings.dashboard.links.from, { sources: sourcesOf(link.sources) }) }}</span>
        </li>
      </ul>

      <p v-else class="link-rollup__none">{{ strings.dashboard.links.none }}</p>
    </div>

    <p class="link-rollup__note">{{ strings.dashboard.links.note }}</p>

    <LinkForm
      v-if="!session.isViewer"
      ref="addForm"
      class="link-rollup__add"
      :heading="strings.dashboard.links.addHeading"
      :submit-label="strings.issue.fields.links.add"
      :error="addError"
      @submit="add"
    />
  </DisclosureSection>
</template>

<script setup lang="ts">
import type { LinkDraft } from '~/stores/issues';
import type { LinkFormProps } from '~/components/molecules/LinkForm/LinkForm.types';
import type { LinkRollupPanelProps } from './LinkRollupPanel.types';

const props = defineProps<LinkRollupPanelProps>();

const session = useSessionStore();
const issuesStore = useIssuesStore();
const dashboard = useDashboardStore();
const { strings, format } = useStrings();
const { copy } = useClipboard({ legacy: true });
const action = reactive(useIssueAction());
const linkError = useLinkError();
const addForm = useTemplateRef<{ reset: () => void }>('addForm');
const addError = ref<LinkFormProps['error']>(null);
const copyMessage = ref('');

const sections = computed(() => rollupSections(props.effort.linkRollup, props.effort, props.rows));

const sourcesOf = (sources: { number: number, closed: boolean }[]) => sources
  .map(({ number, closed }) => format(closed ? strings.value.dashboard.links.sourceClosed : strings.value.dashboard.links.source, { number }))
  .join(strings.value.dashboard.tiles.separator);

const copyArtifacts = async () => {
  copyMessage.value = '';
  try {
    await copy(await dashboard.artifactsMarkdown());
    copyMessage.value = format(strings.value.dashboard.links.copied, { count: props.effort.linkRollup.artifact.length });
  }
  catch {
    copyMessage.value = strings.value.dashboard.links.copyFailed;
  }
};

const add = async (draft: LinkDraft) => {
  addError.value = null;
  const added = await action.run(() => issuesStore.addLink(props.effort.number, draft), (failure) => {
    addError.value = linkError(failure);
    return '';
  });
  if (added) addForm.value?.reset();
};
</script>

<style lang="scss" scoped>
.link-rollup {
  &__section + &__section {
    margin-top: $space-4;
  }

  &__section-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
    margin-bottom: $space-2;
  }

  &__heading {
    margin: 0;
    font-size: $font-size-base;
  }

  &__copy {
    @include button-secondary;
  }

  &__copied {
    margin: 0 0 $space-2;
    color: var(--color-muted);
    font-size: $font-size-meta;

    &:empty {
      display: none;
    }
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__link {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: $space-1 $space-3;
    padding: $space-2 0;

    & + & {
      border-top: 1px dashed var(--color-rule);
    }
  }

  &__type {
    @include label-chip;
    min-width: 64px;
  }

  &__target {
    display: flex;
    flex: 1 1 240px;
    flex-direction: column;
    min-width: 0;
  }

  &__title {
    color: var(--color-accent);
    overflow-wrap: anywhere;
  }

  &__url,
  &__sources {
    color: var(--color-muted);
    font-size: $font-size-meta;
    overflow-wrap: anywhere;
  }

  &__none,
  &__note {
    margin: 0;
    color: var(--color-muted);
  }

  &__note {
    margin-top: $space-3;
    font-size: $font-size-meta;
  }

  &__add {
    margin-top: $space-3;
    padding-top: $space-3;
    border-top: 1px dashed var(--color-rule);

    @include respond(sm) {
      max-width: $sidebar-width;
    }
  }
}
</style>
