import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useInstanceStore } from '~/stores/instance';
import { useSessionStore } from '~/stores/session';
import { apiFailure, viewerSession } from '~/test/issue-fixture';
import AdminSettings from './AdminSettings.vue';

const fresh = { projectName: 'Chartroom', effortName: { singular: 'Effort', plural: 'Efforts' }, triageLabels: {}, version: '0.1.0', updateAvailable: null, openIssues: 0 };

describe('AdminSettings', () => {
  it('announces the server\'s field error on that field and clears it once the field is edited', async () => {
    const remove = registerEndpoint('/ui/instance', { method: 'PATCH', handler: apiFailure(400, { code: 'invalid', message: 'projectName must be a non-empty string', field: 'projectName' }) });
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
    useInstanceStore().instance = fresh;
    const wrapper = await mountSuspended(AdminSettings);

    const field = wrapper.get('input[name="projectName"]');
    await field.setValue(' ');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(field.attributes('aria-invalid')).toBe('true'));
    const message = wrapper.get(`[id="${field.attributes('aria-describedby')}"]`);
    expect(message.text()).toBe('projectName must be a non-empty string');
    expect(message.attributes('role')).toBe('status');

    await field.setValue('Acme');
    expect(field.attributes('aria-invalid')).toBe('false');
    expect(message.text()).toBe('');
    remove();
  });

  it('describes the Effort Display label field with where the word comes from', async () => {
    useSessionStore().me = viewerSession;
    useInstanceStore().instance = fresh;
    const wrapper = await mountSuspended(AdminSettings);

    const field = wrapper.get('input[name="singular"]');
    const descriptions = field.attributes('aria-describedby')!.split(' ').map(id => wrapper.get(`[id="${id}"]`).text());
    expect(descriptions).toContain('An Effort is what Matt Pocock\'s skills call one unit of work (a map, its specs and their tickets); we kept his name, but you can change it to whatever your team says.');
  });

  it('keeps a locked field focusable under its label with a lock mark, and typing into it opens the password prompt under that field', async () => {
    useSessionStore().me = viewerSession;
    useInstanceStore().instance = { projectName: 'Chartroom', effortName: { singular: 'Effort', plural: 'Efforts' }, triageLabels: {}, version: '0.1.0', updateAvailable: null, openIssues: 0 };
    const wrapper = await mountSuspended(AdminSettings, { attachTo: document.body });

    const field = wrapper.get('input[name="projectName"]');
    const label = wrapper.get(`label[for="${field.attributes('id')}"]`);
    expect(field.attributes('aria-disabled')).toBe('true');
    expect(field.attributes('disabled')).toBeUndefined();
    expect(label.text()).toBe('Project name');
    expect(label.find('svg').exists()).toBe(true);

    await field.trigger('keydown', { key: 'a' });

    const prompt = field.element.parentElement!.querySelector('input[type="password"]');
    expect(prompt).not.toBeNull();
    expect(document.activeElement).toBe(prompt);
    expect((field.element as HTMLInputElement).value).toBe('Chartroom');
    wrapper.unmount();
  });
});
