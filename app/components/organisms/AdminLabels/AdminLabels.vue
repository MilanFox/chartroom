<template>
  <AdminSection id="labels" :heading="strings.shell.adminSections.labels" :intro="strings.admin.labels.intro">
    <h3 class="admin-labels__heading">{{ strings.admin.labels.seededHeading }}</h3>

    <p class="admin-labels__muted">{{ strings.admin.labels.seededHint }}</p>

    <ul class="admin-labels__groups">
      <li v-for="group in seededGroups" :key="group.id" class="admin-labels__card" :data-group="group.id">
        <div class="admin-labels__header">
          <h4 class="admin-labels__name">{{ group.displayName }}</h4>

          <code class="admin-labels__id">{{ group.id }}</code>

          <span class="admin-labels__seeded">{{ strings.admin.labels.seeded }}</span>
        </div>

        <ul class="admin-labels__chips" :aria-label="format(strings.admin.labels.members, { group: group.displayName })">
          <li v-for="member in group.labels" :key="member.id" class="admin-labels__chip">
            {{ member.displayLabel }}<code v-if="member.displayLabel !== member.id" class="admin-labels__chip-id">{{ member.id }}</code>
          </li>
        </ul>
      </li>
    </ul>

    <h3 class="admin-labels__heading">{{ strings.admin.labels.adminHeading }}</h3>

    <ul v-if="adminGroups.length" class="admin-labels__groups">
      <LabelGroupCard
        v-for="(group, groupIndex) in adminGroups"
        :key="group.id"
        :ref="card => setCard(group.id, card)"
        :group="group"
        :first="groupIndex === 0"
        :last="groupIndex === adminGroups.length - 1"
      />
    </ul>

    <p v-else class="admin-labels__muted">{{ strings.admin.labels.noGroups }}</p>

    <NewLabelGroupForm @created="focusNewGroup" />

    <FreeFormLabelTable :labels="labelGroupsStore.freeFormLabels" :groups="adminGroups" @promote="promote" />
  </AdminSection>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
interface LabelGroupCardHandle {
  // eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
  prefill(label: string): void
}

const cards = new Map<string, LabelGroupCardHandle>();

const seededGroups = computed(() => labelGroupsStore.labelGroups.filter(group => group.seeded));
const adminGroups = computed(() => labelGroupsStore.labelGroups.filter(group => !group.seeded));

const setCard = (groupId: string, card: Element | ComponentPublicInstance | null) => {
  if (card) cards.set(groupId, card as unknown as LabelGroupCardHandle);
  else cards.delete(groupId);
};

const focusNewGroup = (groupId: string) => focusById(labelDomId('add', groupId));

const promote = (label: string, groupId: string) => cards.get(groupId)?.prefill(label);
</script>

<style lang="scss" scoped>
.admin-labels {
  &__heading {
    margin: $space-6 0 $space-2;
    font-size: $font-size-base;

    &:first-child {
      margin-top: 0;
    }
  }

  &__groups {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__card {
    padding: $space-3;
    border: 1px solid var(--color-rule);
    border-radius: $radius;
  }

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__name {
    margin: 0;
    font-size: $font-size-base;
  }

  &__id,
  &__chip-id {
    color: var(--color-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: $font-size-meta;
  }

  &__chip-id {
    margin-left: $space-1;
  }

  &__seeded {
    @include label-chip;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    margin: $space-2 0 0;
    padding: 0;
    list-style: none;
  }

  &__chip {
    @include label-chip;
  }

  &__muted {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
