<template>
  <ApiReference :configuration="configuration" />
</template>

<script setup lang="ts">
import { ApiReference } from '@scalar/api-reference';
import type { ReferenceProps } from '@scalar/api-reference';
import scalarStyles from '@scalar/api-reference/style.css?inline';

definePageMeta({ layout: false });

const { strings } = useStrings();

const paletteCss = `
.light-mode, .dark-mode {
  --scalar-font: inherit;
  --scalar-background-1: var(--color-surface);
  --scalar-background-2: var(--color-surface-alt);
  --scalar-background-3: var(--color-rule);
  --scalar-background-accent: var(--color-tint-accent);
  --scalar-color-1: var(--color-fg);
  --scalar-color-2: var(--color-muted);
  --scalar-color-3: var(--color-muted);
  --scalar-color-accent: var(--color-accent);
  --scalar-border-color: var(--color-rule);
}`;

const configuration: ReferenceProps['configuration'] = {
  url: '/api/v1/openapi.json',
  authentication: { preferredSecurityScheme: 'bearer' },
  persistAuth: false,
  withDefaultFonts: false,
  telemetry: false,
  agent: { disabled: true },
  mcp: { disabled: true },
  showDeveloperTools: 'never',
  hideClientButton: true,
  hideDarkModeToggle: true,
  customCss: paletteCss,
};

useHead(() => ({
  title: strings.value.shell.apiReference,
  style: [{ innerHTML: scalarStyles }],
}));
</script>
