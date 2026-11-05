import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { requestOf, useEndpoints } from '~/test/endpoints';
import { useSessionStore } from '~/stores/session';
import EnvironmentForm from './EnvironmentForm.vue';

const viewer = { slug: null, displayName: null, viewer: true };
const lapsed = { ...viewer, admin: { until: new Date(Date.now() - 60_000).toISOString() } };
const elevated = { ...viewer, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };

const endpoint = useEndpoints();

describe('EnvironmentForm', () => {
  it('opens the elevation prompt under Save when elevation has lapsed, sending nothing, then saves the typed input once elevated', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/environments', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestOf(event).json());
        return {};
      },
    });
    endpoint('/ui/environments', { method: 'GET', handler: () => ({ items: [], nextCursor: null }) });
    endpoint('/ui/credential-pointers', { method: 'GET', handler: () => ({ items: [], nextCursor: null }) });
    const session = useSessionStore();
    session.me = lapsed;
    const wrapper = await mountSuspended(EnvironmentForm);

    await wrapper.get('input[name="name"]').setValue('Staging');
    await wrapper.get('input[name="url"]').setValue('https://staging.example.test');
    const save = wrapper.get('button[aria-disabled="true"]');
    await save.trigger('click');

    expect(save.element.nextElementSibling?.querySelector('input[type="password"]')).not.toBeNull();
    expect(sent).toEqual([]);
    expect(wrapper.emitted('saved')).toBeUndefined();

    session.me = elevated;
    await vi.waitFor(() => expect(wrapper.find('button[aria-disabled="true"]').exists()).toBe(false));
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(sent).toEqual([{ name: 'Staging', url: 'https://staging.example.test', notes: null }]));
  });
});
