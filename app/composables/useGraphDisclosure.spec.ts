import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import type { IssueKind } from '~/types/api';
import { useGraphDisclosure } from './useGraphDisclosure';

const mountDisclosure = async (kind: IssueKind, state: 'open' | 'closed') => {
  let disclosure: ReturnType<typeof useGraphDisclosure> | null = null;
  const wrapper = await mountSuspended(defineComponent(() => {
    disclosure = useGraphDisclosure(() => ({ number: 7, kind, state }));
    return () => h('div');
  }));
  return { wrapper, disclosure: disclosure! };
};

describe('useGraphDisclosure', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('is open on an open map and collapsed on a spec and on a closed parent', async () => {
    expect((await mountDisclosure('map', 'open')).disclosure.expanded.value).toBe(true);
    expect((await mountDisclosure('spec', 'open')).disclosure.expanded.value).toBe(false);
    expect((await mountDisclosure('map', 'closed')).disclosure.expanded.value).toBe(false);
  });

  it('remembers the section toggle and hide closed across a reload', async () => {
    const first = await mountDisclosure('spec', 'open');

    first.disclosure.toggle();
    first.disclosure.hideClosed.value = true;
    await nextTick();
    first.wrapper.unmount();

    const reloaded = await mountDisclosure('spec', 'open');
    expect(reloaded.disclosure.expanded.value).toBe(true);
    expect(reloaded.disclosure.hideClosed.value).toBe(true);
  });
});
