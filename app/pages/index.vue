<template>
  <div class="efforts-page">
    <Breadcrumb :crumbs="crumbs" />

    <div class="efforts-page__header">
      <h1 class="efforts-page__title">{{ strings.efforts.title }}</h1>

      <button
        v-if="!session.isViewer"
        ref="newEffortButton"
        type="button"
        class="efforts-page__new"
        :aria-expanded="formOpen"
        :aria-controls="formId"
        @click="formOpen = !formOpen"
      >
        <Icon name="plus" :size="14" />{{ strings.efforts.new.open }}
      </button>
    </div>

    <p role="status" class="efforts-page__created">{{ createdMessage }}</p>

    <div :id="formId">
      <NewEffortForm v-if="formOpen && !session.isViewer" @created="announceCreated" @cancel="closeForm" />
    </div>

    <EffortList :efforts="effortsStore.efforts" />
  </div>
</template>

<script setup lang="ts">
const session = useSessionStore();
const effortsStore = useEffortsStore();
const { strings, format } = useStrings();
const crumbs = computed(() => crumbsFor({ page: 'efforts' }, strings.value.breadcrumb));
const formId = useId();
const formOpen = ref(false);
const createdMessage = ref('');
const newEffortButton = useTemplateRef<HTMLButtonElement>('newEffortButton');

useHead(() => ({ title: strings.value.efforts.title }));

const closeForm = () => {
  formOpen.value = false;
  newEffortButton.value?.focus();
};

const announceCreated = (number: number) => {
  createdMessage.value = format(strings.value.efforts.new.created, { number });
  closeForm();
};
</script>

<style lang="scss" scoped>
.efforts-page {
  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $space-2 $space-4;
    margin-bottom: $space-4;
  }

  &__title {
    margin: 0;
  }

  &__new {
    @include button-primary;
    display: inline-flex;
    align-items: center;
    gap: $space-1;
  }

  &__created {
    margin: 0 0 $space-3;
    color: var(--color-muted);

    &:empty {
      margin: 0;
    }
  }
}
</style>
