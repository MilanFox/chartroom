import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { requestOf, useEndpoints } from '~/test/endpoints';
import { useEnvironmentsStore } from '~/stores/environments';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/sessions';
import AdminEnvironments from './AdminEnvironments.vue';

const endpoint = useEndpoints();
const staging = { id: 1, name: 'Staging', url: 'https://staging.example.test', notes: null };
const elevated = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };

const dispatchCancelable = (element: Element, event: Event) => {
  element.dispatchEvent(event);
  return event.defaultPrevented;
};

const pointerSelect = async () => {
  const wrapper = await mountSuspended(AdminEnvironments, { attachTo: document.body });
  return { wrapper, select: wrapper.get('select[aria-label="Environment of QA"]') };
};

describe('AdminEnvironments', () => {
  const sent: unknown[] = [];

  beforeEach(() => {
    sent.length = 0;
    let environment: number | null = null;
    endpoint('/ui/environments', { method: 'GET', handler: () => ({ items: [staging], nextCursor: null }) });
    endpoint('/ui/credential-pointers', { method: 'GET', handler: () => ({ items: [{ id: 4, label: 'QA', accountName: 'qa', whereToFind: 'Vault', environment }], nextCursor: null }) });
    endpoint('/ui/credential-pointers/4', {
      method: 'PATCH', handler: async (event) => {
        const body = await requestOf(event).json();
        sent.push(body);
        ({ environment } = body);
        return {};
      },
    });
    const admin = useEnvironmentsStore();
    admin.environments = [staging];
    admin.pointers = [{ id: 4, label: 'QA', accountName: 'qa', whereToFind: 'Vault', environment: null }];
  });

  it('lets an elevated session rebind a pointer through its Environment select', async () => {
    useSessionStore().me = elevated;
    const { wrapper, select } = await pointerSelect();

    expect(select.attributes('aria-disabled')).toBeUndefined();
    expect(dispatchCancelable(select.element, new MouseEvent('mousedown', { bubbles: true, cancelable: true }))).toBe(false);
    expect(dispatchCancelable(select.element, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))).toBe(false);
    await select.setValue('1');

    await vi.waitFor(() => expect(sent).toEqual([{ environment: 1 }]));
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps a pointer\'s Environment select visible but locked, opening the password prompt in its row when used', async () => {
    useSessionStore().me = viewerSession;
    const { wrapper, select } = await pointerSelect();

    expect(select.attributes('aria-disabled')).toBe('true');
    expect(select.attributes('disabled')).toBeUndefined();
    expect(dispatchCancelable(select.element, new MouseEvent('mousedown', { bubbles: true, cancelable: true }))).toBe(true);
    expect(dispatchCancelable(select.element, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))).toBe(true);
    await nextTick();

    const prompt = select.element.closest('li')!.querySelector('input[type="password"]');
    expect(prompt).not.toBeNull();
    expect(document.activeElement).toBe(prompt);

    await select.setValue('1');
    expect((select.element as HTMLSelectElement).value).toBe('');
    expect(sent).toEqual([]);
    wrapper.unmount();
  });
});
