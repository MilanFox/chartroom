import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiFailure } from '~/test/issue-fixture';
import { useInstanceStore } from './instance';
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
const priority = (labels: { id: string, displayLabel: string }[]) => ({ id: 'priority', displayName: 'Priority', seeded: false, exclusive: true, labels });
const effortGroup = { id: 'effort-size', displayName: 'Effort size', seeded: false, exclusive: true, labels: [] };
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

    expect(admin.environments).toEqual([staging]);
    expect(admin.pointers).toBeNull();
    expect(admin.holders).toBeNull();
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
    const admin = useAdminStore();

    await admin.deleteEnvironment(1);

    expect(admin.environments).toEqual([]);
    expect(admin.pointers?.map(pointer => pointer.environment)).toEqual([null]);
  });

  it('hands back a new holder\'s one-time secret and rereads the roster, which never carries it', async () => {
    const roster: unknown[] = [];
    endpoint('/ui/holders', { method: 'GET', handler: () => roster });
    endpoint('/ui/holders', {
      method: 'POST', handler: async (event) => {
        const { slug } = await requestJson(event);
        roster.push({ slug, displayName: null, revoked: false });
        return { slug, displayName: null, revoked: false, secret: 'chr_alice_secret' };
      },
    });
    const admin = useAdminStore();

    const created = await admin.createHolder({ slug: 'alice', displayName: null });

    expect(created.secret).toBe('chr_alice_secret');
    expect(admin.holders).toEqual([{ slug: 'alice', displayName: null, revoked: false }]);
  });

  it('creating a Label group refreshes the shared groups and the free-form list, so sidebar and Workbench offer it at once', async () => {
    const sent: unknown[] = [];
    let groups: unknown[] = [seeded];
    let freeForm = [{ label: 'high', count: 1 }];
    endpoint('/ui/labels', { method: 'GET', handler: () => groups });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => freeForm });
    endpoint('/ui/label-groups', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestJson(event));
        groups = [seeded, priority([{ id: 'high', displayLabel: 'high' }])];
        freeForm = [];
        return {};
      },
    });
    const admin = useAdminStore();

    await admin.createLabelGroup({ id: 'priority', displayName: 'Priority', labels: [{ id: 'high', displayLabel: null }] });

    expect(sent).toEqual([{ id: 'priority', displayName: 'Priority', labels: [{ id: 'high', displayLabel: null }] }]);
    expect(useLabelGroupsStore().labelGroups.map(group => group.id)).toEqual(['triage-category', 'priority']);
    expect(useLabelGroupsStore().freeFormLabels).toEqual([]);
  });

  it('moving a member down sends the group\'s new member order', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/labels', { method: 'GET', handler: () => [seeded, priority([{ id: 'high', displayLabel: 'High' }, { id: 'low', displayLabel: 'Low' }])] });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [] });
    endpoint('/ui/label-groups/priority/labels/order', {
      method: 'PUT', handler: async (event) => {
        sent.push(await requestJson(event));
        return {};
      },
    });
    const admin = useAdminStore();
    await useLabelGroupsStore().load();

    await admin.moveGroupMember('priority', 'high', 1);

    expect(sent).toEqual([{ labels: ['low', 'high'] }]);
  });

  it('moving an admin group up reorders only the admin groups; the seeded ones stay first', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/labels', { method: 'GET', handler: () => [seeded, priority([]), effortGroup] });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [] });
    endpoint('/ui/label-groups/order', {
      method: 'PUT', handler: async (event) => {
        sent.push(await requestJson(event));
        return [];
      },
    });
    const admin = useAdminStore();
    await useLabelGroupsStore().load();

    await admin.moveLabelGroup('effort-size', -1);

    expect(sent).toEqual([{ groups: ['effort-size', 'priority'] }]);
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
