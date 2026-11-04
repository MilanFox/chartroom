import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import Breadcrumb from './Breadcrumb.vue';

describe('Breadcrumb', () => {
  it('is a named navigation landmark whose last crumb is the current page', async () => {
    const wrapper = await mountSuspended(Breadcrumb, {
      props: { crumbs: [{ label: 'Issues', to: '/issues' }, { label: 'Agent Tracker v1', to: '/efforts/agent-tracker' }, { label: '#12' }] },
    });

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Breadcrumb');
    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual(['/issues', '/efforts/agent-tracker']);
    expect(wrapper.get('[aria-current="page"]').text()).toBe('#12');
  });
});
