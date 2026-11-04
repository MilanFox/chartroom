import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { useAdminStore } from '~/stores/admin';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/issue-fixture';
import FirstRunChecklist from './FirstRunChecklist.vue';

const linksOf = (wrapper: VueWrapper, selector: string) =>
  wrapper.findAll(`${selector} a`).map(link => [link.text(), link.attributes('href')]);

describe('FirstRunChecklist', () => {
  it('asks only for the first Token holder and offers the names and Environments as optional links', async () => {
    useSessionStore().me = viewerSession;
    useAdminStore().holders = [];
    const wrapper = await mountSuspended(FirstRunChecklist);

    expect(linksOf(wrapper, 'ol li')).toEqual([['Create the first Token holder', '#holders']]);
    const optional = wrapper.get('ol + p');
    expect(optional.text()).toBe('Optional: project name, Effort word and Environments — change them any time.');
    expect(linksOf(wrapper, 'ol + p')).toEqual([['project name', '#settings'], ['Effort word', '#settings'], ['Environments', '#environments']]);
    expect(wrapper.get('button').text()).toContain('Enter admin password');
  });
});
