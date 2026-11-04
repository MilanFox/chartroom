import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiFailure } from '~/test/issue-fixture';
import { useInstanceStore } from './instance';
import { useEnvironmentsStore } from './environments';
import { useHoldersStore } from './holders';
import { useLabelGroupsStore } from './label-groups';
import { useAdminStore } from './admin';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));
const requestJson = (event: unknown) => (event as { web: { request: Request } }).web.request.json();
const forbidden = apiFailure(403, { code: 'forbidden', message: 'forbidden' });
const noContent = () => new Response(null, { status: 204 });

const staging = { id: 1, name: 'Staging', url: 'https://staging.example.test', notes: null };
const runtimeSettings = { baseUrl: null, trustProxy: false, port: 3000, updateCheck: true };
const instance = (projectName: string) => ({ projectName, effortName: { singular: 'Effort', plural: 'Efforts' }, triageLabels: {}, version: '0.1.0', updateAvailable: null, openIssues: 0 });

const seeded = { id: 'triage-category', displayName: 'Category', seeded: true, exclusive: true, labels: [{ id: 'bug', displayLabel: 'Bug' }] };
const manualSnapshot = { name: 'manual-20261104-091500', kind: 'manual', takenAt: '2026-11-04T09:15:00.000Z', size: 40960 };

const readsFor = ({ pointers, holders, snapshots = forbidden }: { pointers: () => unknown, holders: () => unknown, snapshots?: () => unknown }) => {
  endpoint('/ui/labels', { method: 'GET', handler: () => [seeded] });
  endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [{ label: 'urgent', count: 2 }] });
  endpoint('/ui/snapshots', { method: 'GET', handler: snapshots });
  endpoint('/ui/environments', { method: 'GET', handler: () => [staging] });
  endpoint('/ui/credential-pointers', { method: 'GET', handler: pointers });
  endpoint('/ui/holders', { method: 'GET', handler: holders });
  endpoint('/ui/runtime', () => runtimeSettings);
  endpoint('/ui/setup', () => ({ firstRun: true }));
};

describe('useAdminStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('loads a non-elevated Viewer\'s page with Environments and About but no pointers or roster', async () => {
    readsFor({ pointers: forbidden, holders: forbidden });
    const admin = useAdminStore();

    await admin.load();

    expect(useEnvironmentsStore().environments).toEqual([staging]);
    expect(useEnvironmentsStore().pointers).toBeNull();
    expect(useHoldersStore().holders).toBeNull();
    expect(admin.runtimeSettings).toEqual(runtimeSettings);
    expect(admin.firstRun).toBe(true);
    expect(admin.snapshots).toBeNull();
    expect(useLabelGroupsStore().labelGroups).toEqual([seeded]);
    expect(useLabelGroupsStore().freeFormLabels).toEqual([{ label: 'urgent', count: 2 }]);
  });

  it('saves the settings and refreshes the instance store so the shell speaks the new name', async () => {
    const sent: unknown[] = [];
    let projectName = 'Chartroom';
    endpoint('/ui/instance', { method: 'GET', handler: () => instance(projectName) });
    endpoint('/ui/instance', {
      method: 'PATCH', handler: async (event) => {
        sent.push(await requestJson(event));
        projectName = 'Acme Tracker';
        return {};
      },
    });
    const admin = useAdminStore();
    const settings = { projectName: 'Acme Tracker', effortName: { singular: 'Effort', plural: null }, triageLabels: { 'needs-info': 'Waiting' } };

    await admin.saveSettings(settings);

    expect(sent).toEqual([settings]);
    expect(useInstanceStore().instance?.projectName).toBe('Acme Tracker');
  });

  it('taking a Snapshot rereads the list, newest first', async () => {
    let snapshots: unknown[] = [];
    endpoint('/ui/snapshots', { method: 'GET', handler: () => snapshots });
    endpoint('/ui/snapshots', {
      method: 'POST', handler: () => {
        snapshots = [manualSnapshot];
        return manualSnapshot;
      },
    });
    const admin = useAdminStore();

    await admin.takeSnapshot();

    expect(admin.snapshots).toEqual([manualSnapshot]);
  });

  it('deleting a manual Snapshot rereads the list', async () => {
    let snapshots: unknown[] = [manualSnapshot];
    endpoint('/ui/snapshots', { method: 'GET', handler: () => snapshots });
    endpoint(`/ui/snapshots/${manualSnapshot.name}`, {
      method: 'DELETE', handler: () => {
        snapshots = [];
        return noContent();
      },
    });
    const admin = useAdminStore();

    await admin.deleteSnapshot(manualSnapshot.name);

    expect(admin.snapshots).toEqual([]);
  });
});
