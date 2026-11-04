import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import InlineConfirm from './InlineConfirm.vue';

const props = { message: 'Delete staging?', confirmLabel: 'Delete', keepLabel: 'Keep' };

describe('InlineConfirm', () => {
  it('is a group named by its message and focuses the confirm button when it opens', async () => {
    const wrapper = await mountSuspended(InlineConfirm, { props, attachTo: document.body });

    const group = wrapper.get('[role="group"]');
    expect(document.getElementById(group.attributes('aria-labelledby')!)?.textContent).toBe('Delete staging?');
    expect(document.activeElement).toBe(wrapper.get('button').element);
    expect(document.activeElement?.textContent).toBe('Delete');
    wrapper.unmount();
  });

  it('emits confirm and keep from its two buttons', async () => {
    const wrapper = await mountSuspended(InlineConfirm, { props });

    const [confirmButton, keepButton] = wrapper.findAll('button');
    await confirmButton!.trigger('click');
    await keepButton!.trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('keep')).toHaveLength(1);
  });

  it('shows the error line only when the caller supplies one', async () => {
    const without = await mountSuspended(InlineConfirm, { props });
    const wrapper = await mountSuspended(InlineConfirm, { props: { ...props, error: 'Could not delete' } });

    expect(without.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).toBe('Could not delete');
  });
});
