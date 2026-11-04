import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiFailure } from '~/test/issue-fixture';
import { useEnvironmentsStore } from './environments';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));
const forbidden = apiFailure(403, { code: 'forbidden', message: 'forbidden' });
const noContent = () => new Response(null, { status: 204 });

const staging = { id: 1, name: 'Staging', url: 'https://staging.example.test', notes: null };

describe('useEnvironmentsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('lists the Environments and leaves the Credential pointers out when the session may not see them', async () => {
    endpoint('/ui/environments', () => [staging]);
    endpoint('/ui/credential-pointers', { method: 'GET', handler: forbidden });
    const environmentsStore = useEnvironmentsStore();

    await environmentsStore.load();

    expect(environmentsStore.environments).toEqual([staging]);
    expect(environmentsStore.pointers).toBeNull();
  });

  it('deleting an Environment rereads the pointers, which come back unbound', async () => {
    let environments = [staging];
    let pointerEnvironment: number | null = 1;
    endpoint('/ui/environments', { method: 'GET', handler: () => environments });
    endpoint('/ui/credential-pointers', { method: 'GET', handler: () => [{ id: 4, label: 'QA', accountName: 'qa', whereToFind: 'Vault', environment: pointerEnvironment }] });
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
