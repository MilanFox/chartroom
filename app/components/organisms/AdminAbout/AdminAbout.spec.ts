import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { useAdminStore } from '~/stores/admin';
import { useInstanceStore } from '~/stores/instance';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/issue-fixture';
import AdminAbout from './AdminAbout.vue';

const RELEASE_URL = 'https://github.com/milanfox/chartroom/releases/tag/v0.2.0';

const withNewerRelease = () => {
  useInstanceStore().instance = {
    projectName: 'Chartroom',
    effortName: { singular: 'Effort', plural: 'Efforts' },
    triageLabels: {},
    version: '0.1.0',
    updateAvailable: { version: '0.2.0', url: RELEASE_URL },
    openIssues: 0,
  };
};

describe('AdminAbout', () => {
  it('an elevated session sees the update chip linking to the release notes in a new tab', async () => {
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
    withNewerRelease();
    const wrapper = await mountSuspended(AdminAbout);

    const chip = wrapper.get(`a[href="${RELEASE_URL}"]`);
    expect(chip.text()).toMatch(/^v0\.2\.0 available\s\(opens in new tab\)$/);
    expect(chip.attributes('target')).toBe('_blank');
    expect(chip.attributes('rel')).toBe('noopener noreferrer');
  });

  it('a session without elevation sees no update chip', async () => {
    useSessionStore().me = viewerSession;
    withNewerRelease();
    const wrapper = await mountSuspended(AdminAbout);

    expect(wrapper.find(`a[href="${RELEASE_URL}"]`).exists()).toBe(false);
    expect(wrapper.text()).not.toContain('available');
  });

  it('lists the project name from the environment among the runtime settings, or none', async () => {
    useSessionStore().me = viewerSession;
    withNewerRelease();
    const runtime = { baseUrl: null, trustProxy: false, port: 3000, updateCheck: true };
    const valueOf = (wrapper: VueWrapper) =>
      wrapper.findAll('.admin-about__value').find(entry => entry.get('dt').text() === 'Project name until saved in Settings')?.get('dd').text();

    useAdminStore().runtimeSettings = { ...runtime, projectName: 'acme-shop' };
    expect(valueOf(await mountSuspended(AdminAbout))).toBe('acme-shop');

    useAdminStore().runtimeSettings = { ...runtime, projectName: null };
    expect(valueOf(await mountSuspended(AdminAbout))).toBe('None');
  });
});
