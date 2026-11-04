import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { useSessionStore } from '~/stores/session';
import LockedField from './LockedField.vue';

const viewer = { slug: null, displayName: null, viewer: true };
const elevated = () => ({ ...viewer, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } });

describe('LockedField', () => {
  it('stays a focusable, labelled input while locked and opens the password prompt under itself on typing', async () => {
    useSessionStore().me = { ...viewer, admin: null };
    const wrapper = await mountSuspended(LockedField, { props: { label: 'Project name', hint: 'Shown in the top bar', modelValue: 'Chartroom' }, attachTo: document.body });

    const input = wrapper.get('input');
    expect(wrapper.get('label').text()).toBe('Project name');
    expect(input.attributes('readonly')).toBeDefined();
    expect(input.attributes('aria-disabled')).toBe('true');
    expect(input.attributes('aria-describedby')).toContain(wrapper.get('p:not([role])').attributes('id'));
    await input.trigger('keydown', { key: 'a' });

    expect(input.element.parentElement?.querySelector('input[type="password"]')).not.toBeNull();
    wrapper.unmount();
  });

  it('edits freely once elevated and tells the parent to clear its error', async () => {
    useSessionStore().me = elevated();
    const wrapper = await mountSuspended(LockedField, { props: { label: 'Project name', modelValue: '' } });

    const input = wrapper.get('input');
    expect(input.attributes('readonly')).toBeUndefined();
    expect(input.attributes('aria-disabled')).toBeUndefined();
    await input.setValue('Harbour');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Harbour']);
    expect(wrapper.emitted('input')).toHaveLength(1);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
  });

  it('marks the input invalid and describes it with the error line', async () => {
    useSessionStore().me = elevated();
    const wrapper = await mountSuspended(LockedField, { props: { label: 'Slug', modelValue: 'x', error: 'Already taken' } });

    const input = wrapper.get('input');
    const errorLine = wrapper.get('p[role="status"]');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toContain(errorLine.attributes('id'));
    expect(errorLine.text()).toBe('Already taken');
  });
});
