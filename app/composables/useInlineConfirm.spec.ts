import { afterEach, describe, expect, it } from 'vitest';
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

  it('opens a confirmation for the given key', () => {
    const { confirming, confirm } = useInlineConfirm({ triggerPrefix: 'admin-delete-' });

    confirm('staging');

    expect(confirming.value).toBe('staging');
  });

  it('keeping closes the confirmation and returns focus to the control that opened it', async () => {
    const trigger = button('admin-delete-staging');
    const { confirming, confirm, keep } = useInlineConfirm({ triggerPrefix: 'admin-delete-' });
    confirm('staging');

    await keep('staging');

    expect(confirming.value).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
