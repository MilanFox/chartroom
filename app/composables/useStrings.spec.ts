import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useInstanceStore } from '~/stores/instance';
import { useStrings } from './useStrings';

const acme = {
  projectName: 'Acme',
  effortName: { singular: 'Initiative', plural: 'Initiatives' },
  triageLabels: {},
  version: '0.1.0',
  updateAvailable: null,
  openIssues: 3,
};

describe('useStrings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('speaks the default names before the Instance is loaded', () => {
    const { strings } = useStrings();

    expect(strings.value.names.project).toBe('Chartroom');
    expect(strings.value.breadcrumb.efforts).toBe('Efforts');
  });

  it('speaks the Instance names once /ui/instance has loaded', async () => {
    const remove = registerEndpoint('/ui/instance', () => acme);
    const { strings } = useStrings();

    await useInstanceStore().load();
    remove();

    expect(strings.value.names.project).toBe('Acme');
    expect(strings.value.breadcrumb.efforts).toBe('Initiatives');
  });
});
