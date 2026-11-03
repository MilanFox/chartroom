import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import DemoButton from './DemoButton.vue';

describe('DemoButton', () => {
  it('matches its snapshot', async () => {
    const wrapper = await mountSuspended(DemoButton, {
      props: { label: 'Click me' },
    });

    expect(wrapper.html()).toMatchSnapshot();
  });
});
