import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { useSessionStore } from '~/stores/session';
import AdminAction from './AdminAction.vue';

const viewer = { slug: null, displayName: null, viewer: true };

describe('AdminAction', () => {
  it('stays a focusable button named by its label while locked and opens the password prompt right after itself', async () => {
    useSessionStore().me = { ...viewer, admin: null };
    const wrapper = await mountSuspended(AdminAction, { props: { label: 'Delete' }, attachTo: document.body });

    const button = wrapper.get('button');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.text()).toBe('Delete');
    await button.trigger('click');

    expect(button.element.nextElementSibling?.querySelector('input[type="password"]')).not.toBeNull();
    expect(wrapper.emitted('run')).toBeUndefined();
    wrapper.unmount();
  });

  it('runs its action once the session is elevated', async () => {
    useSessionStore().me = { ...viewer, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
    const wrapper = await mountSuspended(AdminAction, { props: { label: 'Delete' } });

    const button = wrapper.get('button');
    expect(button.attributes('aria-disabled')).toBeUndefined();
    await button.trigger('click');

    expect(wrapper.emitted('run')).toHaveLength(1);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
  });
});
