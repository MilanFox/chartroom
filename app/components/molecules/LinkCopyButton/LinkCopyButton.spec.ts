import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LinkCopyButton from './LinkCopyButton.vue';

const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }));
mockNuxtImport('useClipboard', () => () => ({ copy: copyMock }));

const props = { url: 'https://example.test/adr', title: 'ADR 0001' };

describe('LinkCopyButton', () => {
  beforeEach(() => {
    copyMock.mockReset();
  });

  it('is a button named by the Link title, in the tab order', async () => {
    const wrapper = await mountSuspended(LinkCopyButton, { props });

    const button = wrapper.get('button');
    expect(button.attributes('aria-label')).toBe('Copy link: ADR 0001');
    expect(button.attributes('tabindex')).toBeUndefined();
  });

  it('copies the Link URL and says so in a polite status region', async () => {
    copyMock.mockResolvedValue(undefined);
    const wrapper = await mountSuspended(LinkCopyButton, { props });
    expect(wrapper.get('[role="status"]').text()).toBe('');

    await wrapper.get('button').trigger('click');

    expect(copyMock).toHaveBeenCalledWith('https://example.test/adr');
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('Copied link: ADR 0001'));
  });

  it('says so when copying fails', async () => {
    copyMock.mockRejectedValue(new Error('denied'));
    const wrapper = await mountSuspended(LinkCopyButton, { props });

    await wrapper.get('button').trigger('click');

    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('Copying failed. Try again.'));
  });

  it('clears the status message after a few seconds', async () => {
    copyMock.mockResolvedValue(undefined);
    const wrapper = await mountSuspended(LinkCopyButton, { props });
    vi.useFakeTimers();

    await wrapper.get('button').trigger('click');
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('Copied link: ADR 0001'));
    await vi.advanceTimersByTimeAsync(4000);

    expect(wrapper.get('[role="status"]').text()).toBe('');
    vi.useRealTimers();
  });
});
