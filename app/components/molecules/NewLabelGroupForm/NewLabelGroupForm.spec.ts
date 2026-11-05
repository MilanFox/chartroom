import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/sessions';
import NewLabelGroupForm from './NewLabelGroupForm.vue';

const endpoint = useEndpoints();

describe('NewLabelGroupForm', () => {
  beforeEach(() => {
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
    endpoint('/ui/labels', { method: 'GET', handler: () => ({ items: [], nextCursor: null }) });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [] });
  });

  it('creates the group, clears the form and announces the new id', async () => {
    const created: unknown[] = [];
    endpoint('/ui/label-groups', {
      method: 'POST', handler: (body: unknown) => {
        created.push(body);
        return {};
      },
    });
    const wrapper = await mountSuspended(NewLabelGroupForm);

    await wrapper.get('input[name="groupId"]').setValue(' size ');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(wrapper.emitted('created')).toEqual([['size']]));
    expect((wrapper.get('input[name="groupId"]').element as HTMLInputElement).value).toBe('');
  });

  it('marks the first-member input when the server rejects it', async () => {
    endpoint('/ui/label-groups', { method: 'POST', handler: apiFailure(400, { code: 'invalid', message: 'bad member', field: 'labels' }) });
    const wrapper = await mountSuspended(NewLabelGroupForm);

    await wrapper.get('input[name="groupId"]').setValue('size');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(wrapper.get('input[name="firstMember"]').attributes('aria-invalid')).toBe('true'));
    expect(wrapper.get('input[name="groupId"]').attributes('aria-invalid')).toBe('false');
  });
});
