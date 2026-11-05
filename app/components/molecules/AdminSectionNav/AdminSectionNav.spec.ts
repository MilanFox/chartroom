import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
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

  it('keeps the linked section until the reader scrolls, then marks the last one past the top bar', async () => {
    endpoint('/ui/me', () => ({ slug: null, displayName: null, viewer: true, admin: null }));
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 5000 });
    const tops = { settings: -400, environments: 200, about: 900 };
    const anchors = Object.entries(tops).map(([id, top]) => {
      const section = document.createElement('section');
      section.id = id;
      section.style.scrollMarginTop = '80px';
      section.getBoundingClientRect = () => ({ top }) as DOMRect;
      return document.body.appendChild(section);
    });
    const wrapper = await mountSuspended(AdminSectionNav, {
      props: { sections: [{ id: 'settings', label: 'Settings' }, { id: 'environments', label: 'Environments' }, { id: 'about', label: 'About' }] },
      route: '/admin#about',
      attachTo: document.body,
    });

    await vi.waitFor(() => expect(wrapper.find('[aria-current]').text()).toBe('About'));
    window.dispatchEvent(new Event('scroll'));
    await flushPromises();
    expect(wrapper.find('[aria-current]').text()).toBe('About');

    window.dispatchEvent(new WheelEvent('wheel'));
    window.dispatchEvent(new Event('scroll'));

    await vi.waitFor(() => expect(wrapper.find('[aria-current]').text()).toBe('Settings'));
    wrapper.unmount();
    anchors.forEach(section => section.remove());
    Reflect.deleteProperty(document.documentElement, 'scrollHeight');
  });
});
