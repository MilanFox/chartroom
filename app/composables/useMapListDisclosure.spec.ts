import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { useMapListDisclosure } from './useMapListDisclosure';

const mountDisclosure = async (mapState: 'open' | 'closed') => {
  let disclosure: ReturnType<typeof useMapListDisclosure> | null = null;
  const wrapper = await mountSuspended(defineComponent(() => {
    disclosure = useMapListDisclosure(2, () => mapState);
    return () => h('div');
  }));
  return { wrapper, disclosure: disclosure! };
};

describe('useMapListDisclosure', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('is open while the map is open and collapsed once it is closed', async () => {
    expect((await mountDisclosure('open')).disclosure.expanded.value).toBe(true);
    expect((await mountDisclosure('closed')).disclosure.expanded.value).toBe(false);
  });

  it('lets the user toggle win over the map state, and keeps the toggle across a reload', async () => {
    const first = await mountDisclosure('open');

    first.disclosure.toggle();
    expect(first.disclosure.expanded.value).toBe(false);
    await nextTick();
    first.wrapper.unmount();

    expect((await mountDisclosure('open')).disclosure.expanded.value).toBe(false);

    const closedMap = await mountDisclosure('closed');
    closedMap.disclosure.toggle();
    await nextTick();
    closedMap.wrapper.unmount();

    expect((await mountDisclosure('closed')).disclosure.expanded.value).toBe(true);
  });
});
