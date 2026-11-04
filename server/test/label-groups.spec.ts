import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';
import type { LaunchedServer } from './harness';

type ApiClient = ReturnType<typeof apiClient>;
type Group = { id: string, seeded: boolean, labels: { id: string }[] };

const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });

const SEEDED_GROUP_IDS = ['triage-category', 'triage-state', 'wayfinder-type'];

const elevatedViewer = async (server: LaunchedServer) => {
  const ui = uiClient(server);
  await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
  await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
  return ui;
};

type IssueSnapshot = { labels: string[], version: number, updatedAt: string, changes: unknown[] };

describe('admin-defined Label groups', () => {
  const server = useTestServer();
  let alice: ApiClient;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const ticket = async (title: string, labels: string[] = []) => (await alice.json('POST', '/issues', { body: { kind: 'ticket', title, labels } })).body as { number: number };
  const snapshot = async (number: number): Promise<IssueSnapshot> => {
    const { labels, version, updatedAt } = (await alice.json('GET', `/issues/${number}`)).body;
    return { labels, version, updatedAt, changes: (await alice.json('GET', `/issues/${number}/changes`)).body.items };
  };
  const groupsListed = async () => (await alice.json('GET', '/labels')).body as Group[];

  it('an elevated session creates a priority group with ordered members; GET /labels lists it after the seeded groups', async () => {
    const admin = await elevatedViewer(server);

    const created = await admin.json('POST', '/label-groups', { body: { id: 'priority', displayName: 'Priority', labels: [{ id: 'high', displayLabel: 'High' }, { id: 'medium' }, { id: 'low' }] } });

    expect(created).toEqual({
      status: 201,
      body: {
        id: 'priority',
        displayName: 'Priority',
        seeded: false,
        exclusive: true,
        labels: [{ id: 'high', displayLabel: 'High' }, { id: 'medium', displayLabel: 'medium' }, { id: 'low', displayLabel: 'low' }],
        updatedAt: expect.any(String),
        updatedBy: 'admin',
      },
    });
    const groups = await groupsListed();
    expect(groups.map(group => group.id)).toEqual([...SEEDED_GROUP_IDS, 'priority']);
    expect(groups[3]).toEqual({ id: 'priority', displayName: 'Priority', seeded: false, exclusive: true, labels: created.body.labels });
    expect(await (await alice.request('GET', '/instance/adapter/issue-tracker.md')).text()).toContain('| `priority` | `high`, `medium`, `low` | yes |');
  });

  it('renaming a group changes its displayName and stamps the admin row; GET /labels reflects it', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'size', labels: [{ id: 'small' }] } });

    const renamed = await admin.json('PATCH', '/label-groups/size', { body: { displayName: 'T-shirt size' } });

    expect(renamed).toMatchObject({ status: 200, body: { id: 'size', displayName: 'T-shirt size', labels: [{ id: 'small', displayLabel: 'small' }], updatedBy: 'admin' } });
    expect((await groupsListed()).find(group => group.id === 'size')).toMatchObject({ displayName: 'T-shirt size' });
  });

  it('adding a member appends it after the existing members', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'impact', labels: [{ id: 'impact-high' }, { id: 'impact-low' }] } });

    const added = await admin.json('POST', '/label-groups/impact/labels', { body: { id: 'impact-none', displayLabel: 'None' } });

    expect(added).toMatchObject({ status: 201, body: { id: 'impact', updatedBy: 'admin' } });
    const expected = [{ id: 'impact-high', displayLabel: 'impact-high' }, { id: 'impact-low', displayLabel: 'impact-low' }, { id: 'impact-none', displayLabel: 'None' }];
    expect(added.body.labels).toEqual(expected);
    expect((await groupsListed()).find(group => group.id === 'impact')).toMatchObject({ labels: expected });
  });

  it('renaming a member changes its displayLabel only', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'risk', labels: [{ id: 'risk-high' }, { id: 'risk-low' }] } });

    const renamed = await admin.json('PATCH', '/label-groups/risk/labels/risk-low', { body: { displayLabel: 'Low risk' } });

    expect(renamed).toMatchObject({ status: 200, body: { id: 'risk', labels: [{ id: 'risk-high', displayLabel: 'risk-high' }, { id: 'risk-low', displayLabel: 'Low risk' }] } });
    expect((await groupsListed()).find(group => group.id === 'risk')).toMatchObject({ labels: renamed.body.labels });
  });

  it('reordering members takes exactly a permutation of the member ids', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'urgency', labels: [{ id: 'urgent' }, { id: 'soon' }, { id: 'someday' }] } });
    const memberIds = async () => (await groupsListed()).find(group => group.id === 'urgency')!.labels.map(label => label.id);

    const reordered = await admin.json('PUT', '/label-groups/urgency/labels/order', { body: { labels: ['someday', 'urgent', 'soon'] } });

    expect(reordered).toMatchObject({ status: 200, body: { id: 'urgency', labels: [{ id: 'someday' }, { id: 'urgent' }, { id: 'soon' }] } });
    expect(await memberIds()).toEqual(['someday', 'urgent', 'soon']);
    for (const labels of [['someday', 'urgent'], ['someday', 'urgent', 'soon', 'high'], ['someday', 'urgent', 'urgent'], 'someday', ['someday', 'urgent', 7]]) {
      expect(await admin.json('PUT', '/label-groups/urgency/labels/order', { body: { labels } }), JSON.stringify(labels)).toMatchObject(invalidOn('labels'));
    }
    expect(await memberIds()).toEqual(['someday', 'urgent', 'soon']);
  });

  it('reordering groups takes exactly a permutation of the admin group ids; seeded groups stay first and a new group lands last', async () => {
    const admin = await elevatedViewer(server);
    const adminGroupIds = async () => (await groupsListed()).filter(group => !group.seeded).map(group => group.id);
    const before = await adminGroupIds();
    const reversed = [...before].reverse();

    const reordered = await admin.json('PUT', '/label-groups/order', { body: { groups: reversed } });

    expect(reordered.status).toBe(200);
    expect(reordered.body.map((group: Group) => group.id)).toEqual(reversed);
    expect(reordered.body[0]).toMatchObject({ seeded: false, updatedBy: 'admin', updatedAt: expect.any(String) });
    expect((await groupsListed()).map(group => group.id)).toEqual([...SEEDED_GROUP_IDS, ...reversed]);
    for (const groups of [reversed.slice(1), [...reversed, 'triage-state'], [...reversed.slice(1), reversed[1]], 'priority']) {
      expect(await admin.json('PUT', '/label-groups/order', { body: { groups } }), JSON.stringify(groups)).toMatchObject(invalidOn('groups'));
    }

    await admin.json('POST', '/label-groups', { body: { id: 'confidence' } });
    expect((await groupsListed()).map(group => group.id)).toEqual([...SEEDED_GROUP_IDS, ...reversed, 'confidence']);
  });

  it('removing a member leaves its label on the issues as a free-form label without touching them', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'tier', labels: [{ id: 'tier-1' }, { id: 'tier-2' }] } });
    const carrier = await ticket('Carries tier-2', ['tier-2']);
    const before = await snapshot(carrier.number);

    const removed = await admin.json('DELETE', '/label-groups/tier/labels/tier-2');

    expect(removed).toMatchObject({ status: 200, body: { id: 'tier', labels: [{ id: 'tier-1' }] } });
    expect(await snapshot(carrier.number)).toEqual(before);
    expect(before.labels).toEqual(['tier-2']);
    await alice.json('PUT', `/issues/${carrier.number}/labels/tier-1`);
    expect((await snapshot(carrier.number)).labels).toEqual(['tier-1', 'tier-2']);
  });

  it('deleting a group leaves its labels as free-form labels without touching the issues; re-creating it re-adopts them', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'phase', labels: [{ id: 'phase-alpha' }, { id: 'phase-beta' }] } });
    const alpha = await ticket('Alpha work', ['phase-alpha']);
    const before = await snapshot(alpha.number);

    expect(await admin.json('DELETE', '/label-groups/phase')).toEqual({ status: 204, body: null });

    expect(await snapshot(alpha.number)).toEqual(before);
    expect((await groupsListed()).map(group => group.id)).not.toContain('phase');
    await alice.json('PUT', `/issues/${alpha.number}/labels/phase-beta`);
    expect((await snapshot(alpha.number)).labels).toEqual(['phase-alpha', 'phase-beta']);
    await alice.json('DELETE', `/issues/${alpha.number}/labels/phase-beta`);

    expect(await admin.json('POST', '/label-groups', { body: { id: 'phase', labels: [{ id: 'phase-alpha' }, { id: 'phase-beta' }] } })).toMatchObject({ status: 201 });
    await alice.json('PUT', `/issues/${alpha.number}/labels/phase-beta`);
    expect((await snapshot(alpha.number)).labels).toEqual(['phase-beta']);
  });

  it('adding a member that is a free-form label on three issues adopts all three; a clash with a sibling is a conflict listing the numbers and writes nothing', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'stage', labels: [{ id: 'stage-done' }] } });
    const one = await ticket('One', ['stage-wip']);
    const two = await ticket('Two', ['stage-wip']);
    const three = await ticket('Three', ['stage-wip', 'stage-done']);
    const groupBefore = (await groupsListed()).find(group => group.id === 'stage');
    const snapshotsBefore = await Promise.all([one, two, three].map(issue => snapshot(issue.number)));

    const clash = await admin.json('POST', '/label-groups/stage/labels', { body: { id: 'stage-wip' } });

    expect(clash).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'labels' } } });
    expect(clash.body.error.message).toContain(`#${three.number}`);
    expect(clash.body.error.message).not.toContain(`#${one.number}`);
    expect((await groupsListed()).find(group => group.id === 'stage')).toEqual(groupBefore);
    expect(await Promise.all([one, two, three].map(issue => snapshot(issue.number)))).toEqual(snapshotsBefore);

    await alice.json('DELETE', `/issues/${three.number}/labels/stage-done`);
    expect(await admin.json('POST', '/label-groups/stage/labels', { body: { id: 'stage-wip' } })).toMatchObject({ status: 201 });
    for (const issue of [one, two, three]) await alice.json('PUT', `/issues/${issue.number}/labels/stage-done`);
    expect(await Promise.all([one, two, three].map(async issue => (await snapshot(issue.number)).labels))).toEqual([['stage-done'], ['stage-done'], ['stage-done']]);
  });

  it('creating a group whose members already sit together on an issue is a conflict listing it and creates nothing', async () => {
    const admin = await elevatedViewer(server);
    const both = await ticket('Both', ['area-api', 'area-ui']);
    const single = await ticket('Single', ['area-api']);

    const clash = await admin.json('POST', '/label-groups', { body: { id: 'area', labels: [{ id: 'area-api' }, { id: 'area-ui' }] } });

    expect(clash).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'labels' } } });
    expect(clash.body.error.message).toContain(`#${both.number}`);
    expect(clash.body.error.message).not.toContain(`#${single.number}`);
    expect((await groupsListed()).map(group => group.id)).not.toContain('area');
  });

  it('a reserved or non-slug group id and a non-slug member id are invalid with the field; order is reserved for both because of the reorder routes', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'shape' } });

    for (const id of ['number', 'title', 'state', 'updated', 'updatedAt', 'createdAt', 'kind', 'label', 'assignee', 'parent', 'effort']) {
      expect(await admin.json('POST', '/label-groups', { body: { id } }), id).toMatchObject(invalidOn('id'));
    }
    for (const id of ['Priority', 'has space', '-lead', 'trail-', 'a--b', 'wayfinder:x', '']) {
      expect(await admin.json('POST', '/label-groups', { body: { id } }), id).toMatchObject(invalidOn('id'));
      expect(await admin.json('POST', '/label-groups', { body: { id: 'fresh', labels: [{ id }] } }), id).toMatchObject(invalidOn('labels'));
      expect(await admin.json('POST', '/label-groups/shape/labels', { body: { id } }), id).toMatchObject(invalidOn('id'));
    }
    expect(await admin.json('POST', '/label-groups', { body: { id: 'order' } })).toMatchObject(invalidOn('id'));
    expect(await admin.json('POST', '/label-groups', { body: { id: 'fresh', labels: [{ id: 'order' }] } })).toMatchObject(invalidOn('labels'));
    expect(await admin.json('POST', '/label-groups/shape/labels', { body: { id: 'order' } })).toMatchObject(invalidOn('id'));
    expect(await admin.json('POST', '/label-groups', { body: { id: 'fresh', labels: 'high' } })).toMatchObject(invalidOn('labels'));
    expect(await admin.json('POST', '/label-groups', { body: { id: 'fresh', labels: ['high'] } })).toMatchObject(invalidOn('labels'));
    expect((await groupsListed()).map(group => group.id)).not.toContain('fresh');
  });

  it('a member id already in any group or twice in the request is invalid; a taken group id is a conflict', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'owner-team', labels: [{ id: 'team-core' }] } });

    expect(await admin.json('POST', '/label-groups', { body: { id: 'fresh', labels: [{ id: 'team-core' }] } })).toMatchObject(invalidOn('labels'));
    expect(await admin.json('POST', '/label-groups', { body: { id: 'fresh', labels: [{ id: 'bug' }] } })).toMatchObject(invalidOn('labels'));
    expect(await admin.json('POST', '/label-groups', { body: { id: 'fresh', labels: [{ id: 'twice' }, { id: 'twice' }] } })).toMatchObject(invalidOn('labels'));
    expect(await admin.json('POST', '/label-groups/owner-team/labels', { body: { id: 'team-core' } })).toMatchObject(invalidOn('id'));
    expect(await admin.json('POST', '/label-groups/owner-team/labels', { body: { id: 'enhancement' } })).toMatchObject(invalidOn('id'));
    expect(await admin.json('POST', '/label-groups', { body: { id: 'owner-team' } })).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'id' } } });
    expect(await admin.json('POST', '/label-groups', { body: { id: 'owner-team', labels: [{ id: 'team-core' }] } })).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'id' } } });
    expect(await admin.json('POST', '/label-groups', { body: { id: 'triage-state' } })).toMatchObject({ status: 409, body: { error: { code: 'conflict', field: 'id' } } });
    expect((await groupsListed()).map(group => group.id)).not.toContain('fresh');
    expect((await groupsListed()).find(group => group.id === 'owner-team')!.labels).toEqual([{ id: 'team-core', displayLabel: 'team-core' }]);
  });

  it('every write to a seeded group is invalid naming id and changes nothing', async () => {
    const admin = await elevatedViewer(server);
    const seededBefore = (await groupsListed()).filter(group => group.seeded);

    const writes: [string, string, unknown?][] = [
      ['PATCH', '/label-groups/triage-state', { displayName: 'Triage' }],
      ['DELETE', '/label-groups/triage-category'],
      ['POST', '/label-groups/triage-category/labels', { id: 'question' }],
      ['PATCH', '/label-groups/triage-state/labels/needs-info', { displayLabel: 'Info please' }],
      ['PUT', '/label-groups/triage-category/labels/order', { labels: ['enhancement', 'bug'] }],
      ['DELETE', '/label-groups/triage-category/labels/bug'],
      ['DELETE', `/label-groups/wayfinder-type/labels/${encodeURIComponent('wayfinder:task')}`],
    ];
    for (const [method, path, body] of writes) {
      expect(await admin.json(method, path, { body }), `${method} ${path}`).toMatchObject(invalidOn('id'));
    }
    expect((await groupsListed()).filter(group => group.seeded)).toEqual(seededBefore);
  });

  it('every write is forbidden without elevation, for a Viewer and a holder session; unknown groups and members are not-found', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'guarded', labels: [{ id: 'guarded-a' }] } });
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const holder = uiClient(server);
    await holder.login(await holderSecret(server, 'bob'));

    const writes: [string, string, unknown?][] = [
      ['POST', '/label-groups', { id: 'sneaky' }],
      ['PATCH', '/label-groups/guarded', { displayName: 'Nope' }],
      ['PUT', '/label-groups/order', { groups: ['guarded'] }],
      ['DELETE', '/label-groups/guarded'],
      ['POST', '/label-groups/guarded/labels', { id: 'guarded-b' }],
      ['PATCH', '/label-groups/guarded/labels/guarded-a', { displayLabel: 'Nope' }],
      ['PUT', '/label-groups/guarded/labels/order', { labels: ['guarded-a'] }],
      ['DELETE', '/label-groups/guarded/labels/guarded-a'],
    ];
    for (const [method, path, body] of writes) {
      expect(await viewer.json(method, path, { body }), `viewer ${method} ${path}`).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
      expect(await holder.json(method, path, { body }), `holder ${method} ${path}`).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    }
    expect((await groupsListed()).find(group => group.id === 'guarded')).toMatchObject({ displayName: 'guarded', labels: [{ id: 'guarded-a' }] });

    const notFound = { status: 404, body: { error: { code: 'not-found' } } };
    expect(await admin.json('PATCH', '/label-groups/nowhere', { body: { displayName: 'X' } })).toMatchObject(notFound);
    expect(await admin.json('DELETE', '/label-groups/nowhere')).toMatchObject(notFound);
    expect(await admin.json('POST', '/label-groups/nowhere/labels', { body: { id: 'orphan' } })).toMatchObject(notFound);
    expect(await admin.json('PUT', '/label-groups/nowhere/labels/order', { body: { labels: [] } })).toMatchObject(notFound);
    expect(await admin.json('PATCH', '/label-groups/guarded/labels/bug', { body: { displayLabel: 'X' } })).toMatchObject(notFound);
    expect(await admin.json('DELETE', '/label-groups/guarded/labels/missing')).toMatchObject(notFound);
  });

  it('adding high to an issue carrying low removes low and logs both, exactly like a seeded group', async () => {
    const carrier = await ticket('Prioritised', ['low', 'frontend']);

    expect(await alice.json('PUT', `/issues/${carrier.number}/labels/high`)).toMatchObject({ status: 204 });

    expect((await snapshot(carrier.number)).labels).toEqual(['frontend', 'high']);
    const labelChanges = (await alice.json('GET', `/issues/${carrier.number}/changes?field=label`)).body.items;
    expect(labelChanges.map(({ before, after }: { before: string | null, after: string | null }) => [before, after])).toEqual([['low', null], [null, 'high']]);
  });

  it('missing=priority and sort=priority work for the admin group in member order, issues without a member last', async () => {
    const effort = (await alice.json('POST', '/issues', { body: { kind: 'effort', title: 'Sorting', name: 'priority-sorting' } })).body;
    const under = (title: string, labels: string[]) => alice.json('POST', '/issues', { body: { kind: 'ticket', title, parent: effort.number, labels } }).then(response => response.body.number as number);
    const low = await under('Low', ['low']);
    const none = await under('None', []);
    const high = await under('High', ['high']);
    const medium = await under('Medium', ['medium']);
    const listed = async (query: string) => (await alice.json('GET', `/issues?effort=priority-sorting&kind=ticket${query}`)).body.items.map((row: { number: number }) => row.number);

    expect(await listed('&missing=priority')).toEqual([none]);
    expect(await listed('&sort=priority')).toEqual([high, medium, low, none]);
    expect(await listed('&sort=priority&order=desc')).toEqual([low, medium, high, none]);
  });
});

describe('the free-form labels read', () => {
  const server = useTestServer();
  let alice: ApiClient;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const ticket = (title: string, labels: string[]) => alice.json('POST', '/issues', { body: { kind: 'ticket', title, labels } });

  it('lists each label that is no group member with its count, most used first, for a non-elevated Viewer', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('POST', '/label-groups', { body: { id: 'priority', labels: [{ id: 'high' }, { id: 'low' }] } });
    await ticket('One', ['frontend', 'high', 'bug']);
    await ticket('Two', ['frontend', 'backend', 'low']);
    await ticket('Three', ['api', 'needs-triage']);
    await ticket('Four', ['frontend', 'api']);
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(await viewer.json('GET', '/labels/free-form')).toEqual({
      status: 200,
      body: [{ label: 'frontend', count: 3 }, { label: 'api', count: 2 }, { label: 'backend', count: 1 }],
    });

    await admin.json('POST', '/label-groups/priority/labels', { body: { id: 'api' } });
    expect((await viewer.json('GET', '/labels/free-form')).body).toEqual([{ label: 'frontend', count: 3 }, { label: 'backend', count: 1 }]);
  });
});
