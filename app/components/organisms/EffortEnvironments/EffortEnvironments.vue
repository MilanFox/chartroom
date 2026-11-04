<template>
  <DisclosureSection :heading="strings.dashboard.environments.heading">
    <ul v-if="groups.length" class="effort-environments__list">
      <li v-for="group in groups" :key="group.key" class="effort-environments__environment">
        <h3 class="effort-environments__name">{{ group.name }}</h3>

        <a v-if="group.url && safeHref(group.url)" :href="safeHref(group.url)!" class="effort-environments__url" target="_blank" rel="noopener noreferrer">{{ group.url }}</a>

        <p v-if="group.notes" class="effort-environments__notes">{{ group.notes }}</p>

        <ul v-if="group.pointers.length" class="effort-environments__pointers" :aria-label="strings.dashboard.environments.pointers">
          <li v-for="pointer in group.pointers" :key="pointer.id" class="effort-environments__pointer">
            <span class="effort-environments__pointer-name">{{ format(strings.dashboard.environments.pointer, { label: pointer.label, account: pointer.accountName }) }}</span>

            <span class="effort-environments__where">{{ pointer.whereToFind }}</span>
          </li>
        </ul>

        <p v-else-if="environmentsStore.pointers" class="effort-environments__muted">{{ strings.dashboard.environments.noPointers }}</p>
      </li>
    </ul>

    <p v-else class="effort-environments__muted">{{ strings.dashboard.environments.empty }}</p>

    <p v-if="!environmentsStore.pointers" class="effort-environments__muted">{{ strings.dashboard.environments.hidden }}</p>
  </DisclosureSection>
</template>

<script setup lang="ts">
const environmentsStore = useEnvironmentsStore();
const { strings, format } = useStrings();

const groups = computed(() => {
  const pointers = environmentsStore.pointers ?? [];
  const environments = environmentsStore.environments.map(environment => ({
    key: `environment-${environment.id}`,
    name: environment.name,
    url: environment.url,
    notes: environment.notes,
    pointers: pointers.filter(pointer => pointer.environment === environment.id),
  }));
  const unbound = pointers.filter(pointer => pointer.environment === null);
  if (!unbound.length) return environments;
  return [...environments, { key: 'any', name: strings.value.dashboard.environments.anyEnvironment, url: null, notes: null, pointers: unbound }];
});
</script>

<style lang="scss" scoped>
.effort-environments {
  &__list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: $space-3;
    margin: 0;
    padding: 0;
    list-style: none;

    @include respond(sm) {
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
  }

  &__environment {
    padding: $space-3;
    border: 1px solid var(--color-rule);
    border-radius: $radius;
  }

  &__name {
    margin: 0;
    font-size: $font-size-base;
  }

  &__url {
    color: var(--color-accent);
    font-size: $font-size-meta;
    overflow-wrap: anywhere;
  }

  &__notes {
    margin: $space-1 0 0;
  }

  &__pointers {
    margin: $space-2 0 0;
    padding: $space-2 0 0;
    border-top: 1px dashed var(--color-rule);
    list-style: none;
  }

  &__pointer {
    display: flex;
    flex-direction: column;

    & + & {
      margin-top: $space-2;
    }
  }

  &__pointer-name {
    font-weight: 500;
  }

  &__where,
  &__muted {
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__muted {
    margin: $space-2 0 0;
  }
}
</style>
