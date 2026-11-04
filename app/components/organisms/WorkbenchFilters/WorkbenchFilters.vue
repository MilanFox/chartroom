<template>
  <div class="workbench-filters">
    <nav class="workbench-filters__views" :aria-labelledby="`${idPrefix}-views`">
      <h2 :id="`${idPrefix}-views`" class="workbench-filters__heading">{{ strings.workbench.views.label }}</h2>

      <ul class="workbench-filters__view-list">
        <li v-for="entry in viewEntries" :key="entry.key">
          <NuxtLink
            :to="{ path: ISSUES_PATH, query: workbench.queryForView(entry.view) }"
            class="workbench-filters__view"
            :aria-current="entry.view === filters.view ? 'true' : undefined"
          >
            {{ entry.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <fieldset class="workbench-filters__narrow" :disabled="filters.numbers.length > 0">
      <legend class="workbench-filters__heading">{{ strings.workbench.narrow }}</legend>

      <p v-if="filters.parent" class="workbench-filters__parent">
        {{ format(strings.workbench.parent, { number: filters.parent }) }}

        <button
          type="button"
          class="workbench-filters__remove"
          :aria-label="format(strings.workbench.removeParent, { number: filters.parent })"
          @click="narrow({ parent: null })"
        >
          <Icon name="close" :size="12" />
        </button>
      </p>

      <label :for="`${idPrefix}-kind`" class="workbench-filters__label">{{ strings.workbench.kind }}</label>

      <select :id="`${idPrefix}-kind`" class="workbench-filters__select" :value="filters.kind ?? ''" @change="narrow({ kind: targetValue($event) || null })">
        <option value="">{{ strings.workbench.anyKind }}</option>

        <option v-for="kind in KINDS" :key="kind" :value="kind">{{ strings.issue.kinds[kind] }}</option>
      </select>

      <label :for="`${idPrefix}-state`" class="workbench-filters__label">{{ strings.workbench.state }}</label>

      <select :id="`${idPrefix}-state`" class="workbench-filters__select" :value="filters.state ?? ''" @change="narrow({ state: targetValue($event) || null })">
        <option value="">{{ strings.workbench.states.default }}</option>

        <option v-for="state in STATES" :key="state" :value="state">{{ strings.workbench.states[state] }}</option>
      </select>

      <template v-for="group in labelGroupsStore.labelGroups" :key="group.id">
        <label :for="`${idPrefix}-group-${group.id}`" class="workbench-filters__label">{{ group.displayName }}</label>

        <select
          :id="`${idPrefix}-group-${group.id}`"
          class="workbench-filters__select"
          :value="workbench.groupChoice(group)"
          @change="apply(workbench.queryWithGroupChoice(group, targetValue($event)))"
        >
          <option value="">{{ strings.workbench.anyMember }}</option>

          <option :value="NO_MEMBER">{{ format(strings.workbench.noMember, { group: group.displayName }) }}</option>

          <option v-for="member in group.labels" :key="member.id" :value="member.id">{{ member.displayLabel }}</option>
        </select>
      </template>

      <label :for="`${idPrefix}-free-form`" class="workbench-filters__label">{{ strings.workbench.freeFormLabel }}</label>

      <input
        :id="`${idPrefix}-free-form`"
        class="workbench-filters__select"
        :value="workbench.chosenFreeFormLabels.join(', ')"
        :list="`${idPrefix}-free-form-options`"
        :aria-describedby="`${idPrefix}-free-form-hint`"
        autocomplete="off"
        @change="apply(workbench.queryWithFreeFormLabels(targetValue($event)))"
      />

      <datalist :id="`${idPrefix}-free-form-options`">
        <option v-for="{ label } in labelGroupsStore.freeFormLabels" :key="label" :value="label" />
      </datalist>

      <p :id="`${idPrefix}-free-form-hint`" class="workbench-filters__hint">{{ strings.workbench.freeFormHint }}</p>

      <label :for="`${idPrefix}-assignee`" class="workbench-filters__label">{{ strings.workbench.assignee }}</label>

      <select :id="`${idPrefix}-assignee`" class="workbench-filters__select" :value="filters.assignee ?? ''" @change="narrow({ assignee: targetValue($event) || null })">
        <option value="">{{ strings.workbench.anyAssignee }}</option>

        <option :value="UNASSIGNED">{{ strings.workbench.unassigned }}</option>

        <option v-for="holder in assigneeOptions" :key="holder.slug" :value="holder.slug">{{ holder.label }}</option>
      </select>

      <label :for="`${idPrefix}-effort`" class="workbench-filters__label">{{ strings.workbench.effort }}</label>

      <select :id="`${idPrefix}-effort`" class="workbench-filters__select" :value="selectedEffort" @change="narrow({ effort: targetValue($event) || null })">
        <option value="">{{ strings.workbench.anyEffort }}</option>

        <option v-for="effort in effortOptions" :key="effort.handle" :value="effort.handle">{{ effort.title }}</option>
      </select>

      <label :for="`${idPrefix}-sort`" class="workbench-filters__label">{{ strings.workbench.sort }}</label>

      <select :id="`${idPrefix}-sort`" class="workbench-filters__select" :value="filters.sort ?? DEFAULT_SORT" @change="apply(workbench.queryWithSort(targetValue($event)))">
        <option v-for="sort in SORTS" :key="sort" :value="sort">{{ strings.workbench.sorts[sort] }}</option>

        <option v-for="group in labelGroupsStore.labelGroups" :key="group.id" :value="group.id">{{ format(strings.workbench.groupSort, { group: group.displayName }) }}</option>
      </select>

      <label :for="`${idPrefix}-order`" class="workbench-filters__label">{{ strings.workbench.order }}</label>

      <select :id="`${idPrefix}-order`" class="workbench-filters__select" :value="filters.order ?? DEFAULT_ORDER" @change="narrow({ order: unlessDefault(targetValue($event), DEFAULT_ORDER) })">
        <option v-for="order in ORDERS" :key="order" :value="order">{{ strings.workbench.orders[order] }}</option>
      </select>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { IssueKind } from '~/types/api';
import type { WorkbenchFilters } from '~/stores/workbench';

const KINDS: IssueKind[] = ['effort', 'map', 'spec', 'ticket'];
const STATES = ['open', 'closed', 'all'] as const;
const SORTS = ['updatedAt', 'number', 'state', 'title'] as const;
const ORDERS = ['desc', 'asc'] as const;
const VIEWS = ['frontier', 'mine', 'needs-triage', 'blocked', 'closed-recent'] as const;

const workbench = useWorkbenchStore();
const labelGroupsStore = useLabelGroupsStore();
const holdersStore = useHoldersStore();
const effortsStore = useEffortsStore();
const session = useSessionStore();
const { strings, format } = useStrings();
const idPrefix = useId();

const filters = computed(() => workbench.filters);

const viewEntries = computed(() => [
  { key: 'all', view: null, label: strings.value.workbench.views.all },
  ...VIEWS.filter(view => view !== 'mine' || !session.isViewer).map(view => ({ key: view, view, label: strings.value.workbench.views[view] })),
]);

const holderLabel = (slug: string, displayName: string | null, revoked: boolean) => {
  const { holder, namedHolder, revokedHolder } = strings.value.workbench;
  const label = displayName ? format(namedHolder, { slug, name: displayName }) : format(holder, { slug });
  return revoked ? format(revokedHolder, { holder: label }) : label;
};

const assigneeOptions = computed(() => {
  const options = holdersStore.assignable.map(({ slug, displayName, revoked }) => ({ slug, label: holderLabel(slug, displayName, revoked) }));
  const { assignee } = filters.value;
  if (assignee && assignee !== UNASSIGNED && !options.some(option => option.slug === assignee)) options.push({ slug: assignee, label: holderLabel(assignee, null, false) });
  return options;
});

const effortOptions = computed(() => effortsStore.efforts.map(effort => ({ handle: effort.name ?? String(effort.number), number: effort.number, title: effort.title })));

const selectedEffort = computed(() => {
  const { effort } = filters.value;
  return effortOptions.value.find(option => option.handle === effort || String(option.number) === effort)?.handle ?? '';
});

const targetValue = (event: Event) => (event.target as HTMLSelectElement | HTMLInputElement).value;

const unlessDefault = (value: string, defaultValue: string) => (value === defaultValue ? null : value);

const apply = (query: Record<string, string | string[]>) => navigateTo({ path: ISSUES_PATH, query });

const narrow = (patch: Partial<WorkbenchFilters>) => apply(workbench.queryWith(patch));
</script>

<style lang="scss" scoped>
.workbench-filters {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__heading {
    margin: 0 0 $space-2;
    padding: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__view-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__view {
    display: block;
    padding: $space-1 $space-2;
    border-radius: $radius-control;
    color: var(--color-fg);
    text-decoration: none;

    &:hover {
      background: var(--color-surface-alt);
    }

    &[aria-current='true'] {
      background: var(--color-accent);
      color: var(--color-on-accent);
      font-weight: 500;
    }
  }

  &__narrow {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;

    &:disabled {
      opacity: 0.6;
    }
  }

  &__label {
    margin: $space-2 0 $space-1;
    font-size: $font-size-meta;
    font-weight: 500;
  }

  &__select {
    @include text-field;
    min-width: 0;
    padding: 0 $space-2;
  }

  &__hint {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__parent {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: $space-1;
    margin: 0 0 $space-1;
    @include label-chip;
  }

  &__remove {
    display: inline-flex;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
  }
}
</style>
