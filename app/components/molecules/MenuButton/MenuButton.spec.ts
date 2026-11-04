import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import MenuItem from '../MenuItem/MenuItem.vue';
import MenuButton from './MenuButton.vue';

const mountMenu = () => mountSuspended(MenuButton, {
  props: { label: 'Admin' },
  slots: {
    trigger: () => 'Admin',
    default: () => ['Settings', 'Labels', 'About'].map(name => h(MenuItem, { to: `/admin#${name.toLowerCase()}` }, () => name)),
  },
  attachTo: document.body,
});

const focused = () => document.activeElement?.textContent?.trim();

describe('MenuButton', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens on ArrowDown with focus on the first item and walks the items with the arrow keys', async () => {
    const wrapper = await mountMenu();
    const trigger = wrapper.get('button[aria-haspopup="menu"]');

    await trigger.trigger('keydown', { key: 'ArrowDown' });

    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[role="menu"]').attributes('aria-label')).toBe('Admin');
    expect(focused()).toBe('Settings');

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowUp' });
    expect(focused()).toBe('About');
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' });
    expect(focused()).toBe('Settings');
  });

  it('closes on Escape and hands focus back to the trigger', async () => {
    const wrapper = await mountMenu();
    const trigger = wrapper.get('button[aria-haspopup="menu"]');
    await trigger.trigger('click');

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' });

    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger.element);
  });

  it('closes on a click outside', async () => {
    const wrapper = await mountMenu();
    const trigger = wrapper.get('button[aria-haspopup="menu"]');
    await trigger.trigger('click');
    await new Promise(resolve => setTimeout(resolve));

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(trigger.attributes('aria-expanded')).toBe('false');
  });
});
