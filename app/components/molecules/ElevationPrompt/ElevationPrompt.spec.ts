import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import ElevationPrompt from './ElevationPrompt.vue';

const endpoint = useEndpoints();

const submitPassword = async (wrapper: Awaited<ReturnType<typeof mountSuspended>>, password: string) => {
  await wrapper.get('input[type="password"]').setValue(password);
  await wrapper.get('input[type="password"]').trigger('keydown', { key: 'Enter' });
};

describe('ElevationPrompt', () => {
  it('labels the password field and reports a wrong password inline as a status message', async () => {
    endpoint('/ui/elevate', { method: 'POST', handler: apiFailure(401, { code: 'unauthenticated', message: 'unauthenticated' }) });
    const wrapper = await mountSuspended(ElevationPrompt);

    const field = wrapper.get('input[type="password"]');
    expect(wrapper.get(`label[for="${field.attributes('id')}"]`).text()).toBe('Admin password');
    await submitPassword(wrapper, 'wrong');

    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('That is not the admin password.'));
    expect(wrapper.emitted('elevated')).toBeUndefined();
  });

  it('reports the rate limit inline', async () => {
    endpoint('/ui/elevate', { method: 'POST', handler: apiFailure(429, { code: 'rate-limited', message: 'rate-limited' }) });
    const wrapper = await mountSuspended(ElevationPrompt);

    await submitPassword(wrapper, 'again');

    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toMatch(/Too many failed attempts/));
  });

  it('elevates with the right password and cancels', async () => {
    endpoint('/ui/elevate', { method: 'POST', handler: () => ({ slug: null, displayName: null, viewer: true, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } }) });
    const wrapper = await mountSuspended(ElevationPrompt);

    await submitPassword(wrapper, 'admin-secret');
    await vi.waitFor(() => expect(wrapper.emitted('elevated')).toHaveLength(1));

    await wrapper.findAll('button').find(button => button.text() === 'Cancel')!.trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
