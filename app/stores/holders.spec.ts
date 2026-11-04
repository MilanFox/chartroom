import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiFailure, requestOf, useEndpoints } from '~/test/endpoints';
import { useHoldersStore } from './holders';

const forbidden = apiFailure(403, { code: 'forbidden', message: 'forbidden' });

describe('useHoldersStore', () => {
  const endpoint = useEndpoints();

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('leaves the roster null when the session may not see it, and offers no assignees', async () => {
    endpoint('/ui/holders', { method: 'GET', handler: forbidden });
    const holdersStore = useHoldersStore();

    await holdersStore.load();

    expect(holdersStore.holders).toBeNull();
    expect(holdersStore.assignable).toEqual([]);
  });

  it('hands back a new holder\'s one-time secret and rereads the roster, which never carries it', async () => {
    const roster: unknown[] = [];
    endpoint('/ui/holders', { method: 'GET', handler: () => roster });
    endpoint('/ui/holders', {
      method: 'POST', handler: async (event) => {
        const { slug } = await requestOf(event).json();
        roster.push({ slug, displayName: null, revoked: false });
        return { slug, displayName: null, revoked: false, secret: 'chr_alice_secret' };
      },
    });
    const holdersStore = useHoldersStore();

    const created = await holdersStore.createHolder({ slug: 'alice', displayName: null });

    expect(created.secret).toBe('chr_alice_secret');
    expect(holdersStore.holders).toEqual([{ slug: 'alice', displayName: null, revoked: false }]);
  });
});
