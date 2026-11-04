<template>
  <header class="top-bar">
    <nav :aria-label="strings.shell.mainNav" class="top-bar__nav">
      <NuxtLink :to="HOME_PATH" class="top-bar__home">{{ strings.names.project }}</NuxtLink>

      <div class="top-bar__wide">
        <MenuButton :label="strings.shell.effortMenu">
          <template #trigger>{{ pickerLabel }}</template>

          <MenuItem v-for="effort in effortLinks" :key="effort.number" :to="effort.to">
            <span>{{ effort.title }}</span>

            <OpenCount :count="effort.open" />
          </MenuItem>

          <li v-if="!effortLinks.length" role="none">
            <span role="menuitem" aria-disabled="true" tabindex="-1" class="top-bar__empty">{{ strings.shell.noEfforts }}</span>
          </li>
        </MenuButton>

        <NuxtLink :to="ISSUES_PATH" class="top-bar__issues">
          {{ strings.shell.issues }}
          <OpenCount :count="openIssues" />
        </NuxtLink>
      </div>
    </nav>

    <div class="top-bar__wide top-bar__end">
      <span v-if="elevationLabel" class="top-bar__elevation">{{ elevationLabel }}</span>

      <MenuButton :label="strings.shell.admin" align="end">
        <template #trigger>{{ strings.shell.admin }}</template>

        <li role="presentation" aria-hidden="true" class="top-bar__menu-heading">{{ strings.shell.admin }}</li>

        <MenuItem v-for="section in adminSections" :key="section.id" :to="section.to">
          <span>{{ section.label }}</span>

          <span v-if="section.chip" class="top-bar__update">{{ section.chip }}</span>
        </MenuItem>

        <li role="separator" class="top-bar__separator" />

        <MenuItem v-if="elevationLabel" @select="dropElevation">
          <span class="top-bar__elevation">{{ elevationLabel }}</span>

          <span class="top-bar__drop">{{ strings.shell.drop }}</span>
        </MenuItem>

        <MenuItem v-else :to="elevateLink">{{ strings.shell.enterAdminPassword }}</MenuItem>
      </MenuButton>

      <MenuButton :label="sessionLabel" align="end">
        <template #trigger>
          <span v-if="session.isViewer" class="top-bar__viewer">{{ strings.shell.viewerChip }}</span>

          <span v-else class="top-bar__holder">{{ session.me?.slug }}</span>
        </template>

        <li role="presentation" aria-hidden="true" class="top-bar__who">{{ sessionLabel }}</li>

        <li role="separator" class="top-bar__separator" />

        <MenuItem @select="logOut">{{ strings.shell.logOut }}</MenuItem>
      </MenuButton>
    </div>

    <PhoneMenu class="top-bar__narrow" />
  </header>
</template>

<script setup lang="ts">
const route = useRoute();
const {
  session,
  strings,
  effortLinks,
  openIssues,
  adminSections,
  elevateLink,
  elevationLabel,
  sessionLabel,
  dropElevation,
  logOut,
} = useShell();

const pickerLabel = computed(() => {
  const current = effortLinks.value.find(effort => effort.to === route.path);
  return current?.title ?? strings.value.shell.effortPicker;
});
</script>

<style lang="scss" scoped>
.top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  min-height: $bar-height;
  padding: 0 $space-4;
  border-bottom: 1px solid var(--color-rule);
  background: var(--color-surface);

  &__nav,
  &__wide,
  &__end {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-width: 0;
  }

  &__wide {
    display: none;

    @include respond(sm) {
      display: flex;
    }
  }

  &__narrow {
    @include respond(sm) {
      display: none;
    }
  }

  &__home {
    margin-right: $space-4;
    color: var(--color-fg);
    font-size: $font-size-h2;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }

  &__issues {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    height: $control-height;
    padding: 0 $space-2;
    border-radius: $radius-control;
    color: var(--color-fg);
    text-decoration: none;

    &:hover {
      background: var(--color-surface-alt);
    }

    &.router-link-active {
      background: var(--color-tint-accent);
      color: var(--color-accent);
    }
  }

  &__empty {
    display: block;
    padding: $space-1 $space-2;
    color: var(--color-muted);
  }

  &__elevation {
    @include elevation-chip;
  }

  &__update {
    @include kind-chip;
  }

  &__drop {
    color: var(--color-accent);
    font-weight: 500;
  }

  &__viewer {
    @include manual-chip;
  }

  &__holder {
    @include label-chip;
    color: var(--color-fg);
  }

  &__menu-heading,
  &__who {
    padding: $space-2 $space-2 $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__menu-heading {
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__separator {
    margin: $space-1 0;
    border-top: 1px solid var(--color-rule);
  }
}
</style>
