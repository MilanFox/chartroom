<template>
  <div class="phone-menu">
    <button
      ref="opener"
      type="button"
      class="phone-menu__opener"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="sheetId"
      :aria-label="strings.shell.openMenu"
      @click="show"
    >
      <Icon name="menu" :size="20" />
    </button>

    <dialog
      :id="sheetId"
      ref="sheet"
      class="phone-menu__sheet"
      :aria-label="strings.shell.phoneMenu"
      @close="onClose"
      @click="onSheetClick"
    >
      <div class="phone-menu__body">
        <button type="button" class="phone-menu__close" :aria-label="strings.shell.closeMenu" @click="hide">
          <Icon name="close" />
        </button>

        <h2 :id="effortsHeadingId" class="phone-menu__heading">{{ strings.names.efforts }}</h2>

        <ul class="phone-menu__list" :aria-labelledby="effortsHeadingId">
          <li v-for="effort in effortLinks" :key="effort.number">
            <NuxtLink :to="effort.to" class="phone-menu__link">
              <span>{{ effort.title }}</span>

              <OpenCount :count="effort.open" />
            </NuxtLink>
          </li>

          <li v-if="!effortLinks.length" class="phone-menu__empty">{{ strings.shell.noEfforts }}</li>
        </ul>

        <ul class="phone-menu__list phone-menu__list--ruled">
          <li>
            <NuxtLink :to="ISSUES_PATH" class="phone-menu__link">
              <span>{{ strings.shell.issues }}</span>

              <OpenCount :count="openIssues" />
            </NuxtLink>
          </li>
        </ul>

        <h2 :id="adminHeadingId" class="phone-menu__heading">{{ strings.shell.admin }}</h2>

        <ul class="phone-menu__list" :aria-labelledby="adminHeadingId">
          <li v-for="section in adminSections" :key="section.id">
            <NuxtLink :to="section.to" class="phone-menu__link">
              <span>{{ section.label }}</span>

              <span v-if="section.chip" class="phone-menu__update">{{ section.chip }}</span>
            </NuxtLink>
          </li>

          <li class="phone-menu__elevation">
            <template v-if="elevationLabel">
              <span class="phone-menu__chip">{{ elevationLabel }}</span>

              <button type="button" class="phone-menu__action" @click="dropElevation">{{ strings.shell.drop }}</button>
            </template>

            <NuxtLink v-else :to="elevateLink" class="phone-menu__link">{{ strings.shell.enterAdminPassword }}</NuxtLink>
          </li>
        </ul>

        <div class="phone-menu__session">
          <p class="phone-menu__who">{{ sessionLabel }}</p>

          <button type="button" class="phone-menu__action" @click="logOut">{{ strings.shell.logOut }}</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
const {
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

const opener = useTemplateRef('opener');
const sheet = useTemplateRef('sheet');
const sheetId = useId();
const effortsHeadingId = useId();
const adminHeadingId = useId();
const open = ref(false);

const show = () => {
  sheet.value?.showModal();
  open.value = true;
};

const hide = () => sheet.value?.close();

const onClose = () => {
  open.value = false;
  opener.value?.focus();
};

const onSheetClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target === sheet.value || target.closest('a')) hide();
};
</script>

<style lang="scss" scoped>
.phone-menu {
  &__opener,
  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: $control-height;
    height: $control-height;
    border: 1px solid var(--color-rule);
    border-radius: $radius-control;
    background: var(--color-surface);
    color: var(--color-fg);
    cursor: pointer;
  }

  &__close {
    float: right;
    border-color: transparent;
  }

  &__sheet {
    @include card;
    position: fixed;
    inset: $bar-height + $space-2 $space-2 auto auto;
    width: min($sidebar-width, calc(100vw - #{$space-4}));
    max-height: calc(100dvh - #{$bar-height + $space-4});
    margin: 0;
    padding: 0;
    overflow-y: auto;
    color: var(--color-fg);

    &::backdrop {
      background: var(--color-scrim);
    }
  }

  &__body {
    padding: $space-2 $space-3 $space-3;
  }

  &__heading {
    margin: $space-2 0 $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;

    &--ruled {
      margin: $space-2 0;
      padding: $space-2 0;
      border-top: 1px solid var(--color-rule);
      border-bottom: 1px solid var(--color-rule);
    }
  }

  &__link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    min-height: $control-height;
    padding: $space-1 $space-2;
    border-radius: $radius-control;
    color: var(--color-fg);
    text-decoration: none;

    &:hover {
      background: var(--color-surface-alt);
    }

    &.router-link-exact-active {
      font-weight: 600;
    }
  }

  &__empty {
    padding: $space-1 $space-2;
    color: var(--color-muted);
  }

  &__elevation {
    display: flex;
    align-items: center;
    gap: $space-2;
    margin-top: $space-2;
    padding-top: $space-2;
    border-top: 1px solid var(--color-rule);
  }

  &__chip {
    @include elevation-chip;
    margin-left: $space-2;
  }

  &__update {
    @include kind-chip;
  }

  &__action {
    @include button-quiet;
    font-size: $font-size-base;
  }

  &__session {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
    margin-top: $space-2;
    padding-top: $space-2;
    border-top: 1px solid var(--color-rule);
  }

  &__who {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }
}
</style>
