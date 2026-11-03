import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from './demo';

describe('useDemoStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('increments and derives the double value', () => {
    const store = useDemoStore();

    store.increment();

    expect(store.count).toBe(1);
    expect(store.double).toBe(2);
  });

  it('resets the count', () => {
    const store = useDemoStore();

    store.increment();
    store.reset();

    expect(store.count).toBe(0);
  });
});
