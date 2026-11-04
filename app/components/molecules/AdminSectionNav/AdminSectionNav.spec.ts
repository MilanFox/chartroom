import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import AdminSectionNav from './AdminSectionNav.vue';
import { useEndpoints } from '~/test/endpoints';

const endpoint = useEndpoints();

describe('AdminSectionNav', () => {
  it('links each section by its anchor and marks only the current one', async () => {
    endpoint('/ui/me', () => ({ slug: null, displayName: null, viewer: true, admin: null }));
    const wrapper = await mountSuspended(AdminSectionNav, {
      props: { sections: [{ id: 'settings', label: 'Settings' }, { id: 'about', label: 'About' }] },
      route: '/admin#about',
    });

    const links = wrapper.findAll('a');
    expect(links.map(link => link.attributes('href'))).toEqual(['/admin#settings', '/admin#about']);
    expect(links.map(link => link.attributes('aria-current') ?? null)).toEqual([null, 'location']);
  });
});
