<template>
  <AdminSection id="about" :heading="strings.shell.adminSections.about">
    <dl class="admin-about__values">
      <div class="admin-about__value">
        <dt>{{ strings.admin.about.version }}</dt>

        <dd>
          {{ instanceStore.instance?.version }}

          <span v-if="updateLabel" class="admin-about__update">{{ updateLabel }}</span>
        </dd>
      </div>
    </dl>

    <FieldRow :heading="strings.admin.about.runtime">
      <p class="admin-about__hint">{{ strings.admin.about.runtimeHint }}</p>

      <dl v-if="admin.runtimeSettings" class="admin-about__values">
        <div v-for="entry in runtimeEntries" :key="entry.label" class="admin-about__value">
          <dt>{{ entry.label }}</dt>

          <dd class="admin-about__code">{{ entry.value }}</dd>
        </div>
      </dl>
    </FieldRow>

    <FieldRow :heading="strings.admin.about.adapter">
      <ul class="admin-about__links">
        <li><a :href="ADAPTER_PATHS.issueTracker" class="admin-about__link">{{ strings.admin.about.issueTracker }}</a></li>

        <li><a :href="ADAPTER_PATHS.triageLabels" class="admin-about__link">{{ strings.admin.about.triageLabels }}</a></li>
      </ul>
    </FieldRow>
  </AdminSection>
</template>

<script setup lang="ts">
const ADAPTER_PATHS = {
  issueTracker: '/ui/instance/adapter/issue-tracker.md',
  triageLabels: '/ui/instance/adapter/triage-labels.md',
};

const session = useSessionStore();
const instanceStore = useInstanceStore();
const admin = useAdminStore();
const { strings, format } = useStrings();

const updateLabel = computed(() => {
  const version = instanceStore.instance?.updateAvailable;
  return session.adminUntil && version ? format(strings.value.shell.updateAvailable, { version }) : null;
});

const runtimeEntries = computed(() => {
  const labels = strings.value.admin.about;
  const runtime = admin.runtimeSettings!;
  const onOff = (value: boolean) => (value ? labels.on : labels.off);
  return [
    { label: labels.baseUrl, value: runtime.baseUrl ?? labels.derived },
    { label: labels.trustProxy, value: onOff(runtime.trustProxy) },
    { label: labels.port, value: String(runtime.port) },
    { label: labels.updateCheck, value: onOff(runtime.updateCheck) },
  ];
});
</script>

<style lang="scss" scoped>
.admin-about {
  &__values {
    display: grid;
    gap: $space-1;
    margin: 0;
  }

  &__value {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
    gap: $space-3;

    dt {
      color: var(--color-muted);
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  &__code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: $font-size-meta;
  }

  &__update {
    @include kind-chip;
    margin-left: $space-2;
  }

  &__hint {
    margin: 0 0 $space-2;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__links {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2 $space-4;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__link {
    color: var(--color-accent);
  }
}
</style>
