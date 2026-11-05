import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { apiFailure, requestOf, useEndpoints } from '~/test/endpoints';
import { useSessionStore } from '~/stores/session';
import { useEnvironmentsStore } from '~/stores/environments';
import PointerForm from './PointerForm.vue';

const dev = { id: 1, name: 'Dev', url: 'https://dev.example.test', notes: null };

const viewer = { slug: null, displayName: null, viewer: true };
const lapsed = { ...viewer, admin: { until: new Date(Date.now() - 60_000).toISOString() } };
const elevated = { ...viewer, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };

const endpoint = useEndpoints();

describe('PointerForm', () => {
  it('shows the server\'s refusal of a secret-looking account name on that field', async () => {
    endpoint('/ui/credential-pointers', {
      method: 'POST',
      handler: apiFailure(400, { code: 'invalid', message: 'Server says: not a secret here', field: 'accountName' }),
    });
    const wrapper = await mountSuspended(PointerForm);

    await wrapper.get('input[name="label"]').setValue('Deploy bot');
    await wrapper.get('input[name="accountName"]').setValue('ghp_abcdefabcdefabcdefabcdefabcdef123456');
    await wrapper.get('input[name="whereToFind"]').setValue('1Password, item "Deploy bot"');
    await wrapper.get('form').trigger('submit');

    const field = wrapper.get('input[name="accountName"]');
    await vi.waitFor(() => expect(field.attributes('aria-invalid')).toBe('true'));
    const message = wrapper.get(`[id="${field.attributes('aria-describedby')}"]`);
    expect(message.text()).toBe('Server says: not a secret here');
    expect(message.attributes('role')).toBe('status');
    expect(wrapper.get('input[name="label"]').attributes('aria-invalid')).toBe('false');
    expect(wrapper.emitted('saved')).toBeUndefined();

    await field.setValue('deploy-bot');
    expect(field.attributes('aria-invalid')).toBe('false');
    expect(message.text()).toBe('');
  });

  it('binds the new pointer to the Environment picked in its select', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/credential-pointers', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestOf(event).json());
        return {};
      },
    });
    endpoint('/ui/credential-pointers', { method: 'GET', handler: () => ({ items: [], nextCursor: null }) });
    endpoint('/ui/environments', { method: 'GET', handler: () => ({ items: [dev], nextCursor: null }) });
    useEnvironmentsStore().environments = [dev];
    const wrapper = await mountSuspended(PointerForm);

    await wrapper.get('input[name="label"]').setValue('Deploy bot');
    await wrapper.get('input[name="accountName"]').setValue('deploy-bot');
    await wrapper.get('input[name="whereToFind"]').setValue('1Password');
    await wrapper.get('select[name="environment"]').setValue('1');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(sent).toEqual([{ label: 'Deploy bot', accountName: 'deploy-bot', whereToFind: '1Password', environment: 1 }]));
  });

  it('opens the elevation prompt under Save when elevation has lapsed, sending nothing, then saves the typed input once elevated', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/credential-pointers', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestOf(event).json());
        return {};
      },
    });
    endpoint('/ui/credential-pointers', { method: 'GET', handler: () => ({ items: [], nextCursor: null }) });
    endpoint('/ui/environments', { method: 'GET', handler: () => ({ items: [], nextCursor: null }) });
    const session = useSessionStore();
    session.me = lapsed;
    const wrapper = await mountSuspended(PointerForm);

    await wrapper.get('input[name="label"]').setValue('Deploy bot');
    await wrapper.get('input[name="accountName"]').setValue('deploy-bot');
    await wrapper.get('input[name="whereToFind"]').setValue('1Password');
    const save = wrapper.get('button[aria-disabled="true"]');
    await save.trigger('click');

    expect(save.element.nextElementSibling?.querySelector('input[type="password"]')).not.toBeNull();
    expect(sent).toEqual([]);
    expect(wrapper.emitted('saved')).toBeUndefined();

    session.me = elevated;
    await vi.waitFor(() => expect(wrapper.find('button[aria-disabled="true"]').exists()).toBe(false));
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(sent).toEqual([{ label: 'Deploy bot', accountName: 'deploy-bot', whereToFind: '1Password', environment: null }]));
  });
});
