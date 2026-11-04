import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { useInlineConfirm } from './useInlineConfirm';

const button = (id: string) => {
  const element = document.createElement('button');
  element.id = id;
  document.body.append(element);
  return element;
};

describe('useInlineConfirm', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('opens a confirmation and moves focus to its confirm button, which renders on the next tick', async () => {
    const { confirming, confirm } = useInlineConfirm({ baseId: 'admin', triggerPrefix: 'admin-delete-' });

    confirm('staging');
    const confirmButton = button('admin-confirm-button-staging');
    await nextTick();

    expect(confirming.value).toBe('staging');
    expect(document.activeElement).toBe(confirmButton);
  });

  it('keeping closes the confirmation and returns focus to the control that opened it', async () => {
    const trigger = button('admin-delete-staging');
    const { confirming, confirm, keep } = useInlineConfirm({ baseId: 'admin', triggerPrefix: 'admin-delete-' });
    confirm('staging');

    await keep('staging');

    expect(confirming.value).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
