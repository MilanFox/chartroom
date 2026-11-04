<template>
  <section class="first-run" :aria-labelledby="headingId">
    <h2 :id="headingId" class="first-run__heading">
      {{ strings.admin.firstRun.heading }}

      <span v-if="locked" class="first-run__hint">{{ strings.admin.firstRun.hint }}</span>
    </h2>

    <ol class="first-run__steps">
      <li v-for="step in steps" :key="step.id" :class="{ 'first-run__step--done': step.done }">
        <a :href="`#${step.section}`" class="first-run__link">
          <s v-if="step.done">{{ strings.admin.firstRun.steps[step.id] }}</s>

          <template v-else>{{ strings.admin.firstRun.steps[step.id] }}</template>
        </a>

        <span v-if="step.done" class="first-run__done">({{ strings.admin.firstRun.done }})</span>
      </li>
    </ol>

    <template v-if="locked">
      <button ref="opener" type="button" class="first-run__elevate" :aria-expanded="prompting" @click="prompting = !prompting">
        {{ strings.admin.firstRun.enterPassword }}<Icon name="lock" :size="12" class="first-run__lock" />
      </button>

      <ElevationPrompt v-if="prompting" @elevated="prompting = false" @cancel="cancel" />
    </template>
  </section>
</template>

<script setup lang="ts">
import catalog from '~/strings/en.json';

const session = useSessionStore();
const instanceStore = useInstanceStore();
const admin = useAdminStore();
const { strings } = useStrings();
const headingId = useId();
const opener = useTemplateRef<HTMLButtonElement>('opener');
const prompting = ref(false);

const locked = computed(() => !session.adminUntil);

const steps = computed(() => firstRunChecklist({
  names: instanceStore.instance,
  defaults: catalog.names,
  environments: admin.environments.length,
  holders: admin.holders?.length ?? 0,
  settingsSaved: admin.settingsSaved,
}));

const cancel = async () => {
  prompting.value = false;
  await nextTick();
  opener.value?.focus();
};
</script>

<style lang="scss" scoped>
.first-run {
  padding: $space-4;
  border: 1px solid var(--color-tint-frontier);
  border-radius: $radius;
  background: var(--color-tint-accent);

  &__heading {
    margin: 0;
    font-size: $font-size-base;
  }

  &__hint {
    color: var(--color-muted);
    font-size: $font-size-meta;
    font-weight: 400;
  }

  &__steps {
    margin: $space-2 0 $space-3;
    padding-left: $space-6;

    li + li {
      margin-top: $space-1;
    }
  }

  &__link {
    color: var(--color-accent);
  }

  &__step--done &__link {
    color: var(--color-muted);
  }

  &__done {
    @include visually-hidden;
  }

  &__elevate {
    @include button-primary;
  }

  &__lock {
    margin-left: $space-1;
  }
}
</style>
