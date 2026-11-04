import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEndpoints } from '~/test/endpoints';
import { useHoldersStore } from '~/stores/holders';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/sessions';
import AdminHolders from './AdminHolders.vue';

const endpoint = useEndpoints();
const alice = { slug: 'alice', displayName: 'Alice', revoked: false, createdAt: '2026-11-04T09:00:00.000Z', lastUsedAt: null, revokedAt: null };
const buttonNamed = (wrapper: VueWrapper, name: string) => wrapper.findAll('button').filter(button => button.text() === name);

describe('AdminHolders', () => {
  beforeEach(() => {
    useSessionStore().me = { slug: null, displayName: null, viewer: true, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
  });

  it('shows a new holder\'s secret once, gone after Done', async () => {
    const roster: unknown[] = [];
    endpoint('/ui/holders', { method: 'GET', handler: () => roster });
    endpoint('/ui/holders', {
      method: 'POST', handler: () => {
        roster.push(alice);
        return { ...alice, secret: 'chr_alice_onetime' };
      },
    });
    useHoldersStore().holders = [];
    const wrapper = await mountSuspended(AdminHolders);

    await wrapper.get('input[name="slug"]').setValue('alice');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(wrapper.get('code').text()).toBe('chr_alice_onetime'));
    expect(wrapper.get('tbody th').text()).toBe('alice');
    await buttonNamed(wrapper, 'Done')[0]!.trigger('click');
    expect(wrapper.text()).not.toContain('chr_alice_onetime');
  });

  it('derives the slug from the display name until the slug is edited, and again once it is cleared', async () => {
    useHoldersStore().holders = [];
    const wrapper = await mountSuspended(AdminHolders);
    const displayName = wrapper.get('input[name="displayName"]');
    const slug = wrapper.get<HTMLInputElement>('input[name="slug"]');

    await displayName.setValue('Jürgen Müller');
    expect(slug.element.value).toBe('jurgen-muller');

    await slug.setValue('juergen');
    await displayName.setValue('Jürgen M.');
    expect(slug.element.value).toBe('juergen');

    await slug.setValue('');
    await displayName.setValue('Agent tracker');
    expect(slug.element.value).toBe('agent-tracker');
  });

  it('follows the display name again after a holder is created from an edited slug', async () => {
    endpoint('/ui/holders', { method: 'GET', handler: () => [alice] });
    endpoint('/ui/holders', { method: 'POST', handler: () => ({ ...alice, secret: 'chr_alice_onetime' }) });
    useHoldersStore().holders = [];
    const wrapper = await mountSuspended(AdminHolders);
    const slug = wrapper.get<HTMLInputElement>('input[name="slug"]');

    await wrapper.get('input[name="displayName"]').setValue('Alice');
    await slug.setValue('alice');
    await wrapper.get('form').trigger('submit');
    await vi.waitFor(() => expect(wrapper.get('code').text()).toBe('chr_alice_onetime'));

    await wrapper.get('input[name="displayName"]').setValue('Bob Builder');
    expect(slug.element.value).toBe('bob-builder');
  });

  it('revokes only after an inline confirmation, striking the row through and keeping it listed', async () => {
    endpoint('/ui/holders', { method: 'GET', handler: () => [{ ...alice, revoked: true, revokedAt: '2026-11-04T10:00:00.000Z' }] });
    endpoint('/ui/holders/alice/revoke', { method: 'POST', handler: () => ({ ...alice, revoked: true }) });
    useHoldersStore().holders = [alice];
    const wrapper = await mountSuspended(AdminHolders);

    await buttonNamed(wrapper, 'Revoke')[0]!.trigger('click');
    expect(wrapper.get('[role="group"]').text()).toMatch(/Revoke alice for good\?/);
    await buttonNamed(wrapper, 'Revoke')[1]!.trigger('click');

    await vi.waitFor(() => expect(wrapper.get('tbody tr').classes()).toContain('admin-holders__row--revoked'));
    expect(wrapper.get('tbody th').text()).toBe('alice');
  });

  it('keeps the create form\'s fields locked with a lock mark, opening the password prompt under the field that was clicked', async () => {
    useSessionStore().me = viewerSession;
    useHoldersStore().holders = null;
    const wrapper = await mountSuspended(AdminHolders, { attachTo: document.body });

    const field = wrapper.get('input[name="displayName"]');
    expect(field.attributes('aria-disabled')).toBe('true');
    expect(wrapper.get(`label[for="${field.attributes('id')}"]`).find('svg').exists()).toBe(true);
    await field.trigger('click');

    expect(field.element.parentElement!.querySelector('input[type="password"]')).not.toBeNull();
    wrapper.unmount();
  });
});
