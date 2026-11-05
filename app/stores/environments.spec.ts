import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import { useEnvironmentsStore } from './environments';

const forbidden = apiFailure(403, { code: 'forbidden', message: 'forbidden' });
const noContent = () => new Response(null, { status: 204 });

const staging = { id: 1, name: 'Staging', url: 'https://staging.example.test', notes: null };

describe('useEnvironmentsStore', () => {
  const endpoint = useEndpoints();

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('lists the Environments and leaves the Credential pointers out when the session may not see them', async () => {
    endpoint('/ui/environments', () => ({ items: [staging], nextCursor: null }));
    endpoint('/ui/credential-pointers', { method: 'GET', handler: forbidden });
    const environmentsStore = useEnvironmentsStore();

    await environmentsStore.load();

    expect(environmentsStore.environments).toEqual([staging]);
    expect(environmentsStore.pointers).toBeNull();
  });

  it('deleting an Environment rereads the pointers, which come back unbound', async () => {
    let environments = [staging];
    let pointerEnvironment: number | null = 1;
    endpoint('/ui/environments', { method: 'GET', handler: () => ({ items: environments, nextCursor: null }) });
    endpoint('/ui/credential-pointers', { method: 'GET', handler: () => ({ items: [{ id: 4, label: 'QA', accountName: 'qa', whereToFind: 'Vault', environment: pointerEnvironment }], nextCursor: null }) });
    endpoint('/ui/environments/1', {
      method: 'DELETE', handler: () => {
        environments = [];
        pointerEnvironment = null;
        return noContent();
      },
    });
    const environmentsStore = useEnvironmentsStore();

    await environmentsStore.deleteEnvironment(1);

    expect(environmentsStore.environments).toEqual([]);
    expect(environmentsStore.pointers?.map(pointer => pointer.environment)).toEqual([null]);
  });
});
