import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFailure } from '~/test/issue-fixture';
import { useAdminStore } from '~/stores/admin';
import PointerForm from './PointerForm.vue';

const dev = { id: 1, name: 'Dev', url: 'https://dev.example.test', notes: null };

const unregister: (() => void)[] = [];

describe('PointerForm', () => {
  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('shows the server\'s refusal of a secret-looking account name on that field', async () => {
    unregister.push(registerEndpoint('/ui/credential-pointers', {
      method: 'POST',
      handler: apiFailure(400, { code: 'invalid', message: 'Server says: not a secret here', field: 'accountName' }),
    }));
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
    unregister.push(registerEndpoint('/ui/credential-pointers', {
      method: 'POST', handler: async (event) => {
        sent.push(await (event as unknown as { web: { request: Request } }).web.request.json());
        return {};
      },
    }));
    unregister.push(registerEndpoint('/ui/credential-pointers', { method: 'GET', handler: () => [] }));
    unregister.push(registerEndpoint('/ui/environments', { method: 'GET', handler: () => [dev] }));
    useAdminStore().environments = [dev];
    const wrapper = await mountSuspended(PointerForm);

    await wrapper.get('input[name="label"]').setValue('Deploy bot');
    await wrapper.get('input[name="accountName"]').setValue('deploy-bot');
    await wrapper.get('input[name="whereToFind"]').setValue('1Password');
    await wrapper.get('select[name="environment"]').setValue('1');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(sent).toEqual([{ label: 'Deploy bot', accountName: 'deploy-bot', whereToFind: '1Password', environment: 1 }]));
  });
});
