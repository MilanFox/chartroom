import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { requestOf, useEndpoints } from '~/test/endpoints';
import { useLabelGroupsStore } from './label-groups';

const seeded = { id: 'triage-category', displayName: 'Category', seeded: true, exclusive: true, labels: [{ id: 'bug', displayLabel: 'Bug' }] };
const priority = (labels: { id: string, displayLabel: string }[]) => ({ id: 'priority', displayName: 'Priority', seeded: false, exclusive: true, labels });
const effortGroup = { id: 'effort-size', displayName: 'Effort size', seeded: false, exclusive: true, labels: [] };

describe('useLabelGroupsStore', () => {
  const endpoint = useEndpoints();

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('creating a Label group refreshes the shared groups and the free-form list, so sidebar and Workbench offer it at once', async () => {
    const sent: unknown[] = [];
    let groups: unknown[] = [seeded];
    let freeForm = [{ label: 'high', count: 1 }];
    endpoint('/ui/labels', { method: 'GET', handler: () => ({ items: groups, nextCursor: null }) });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => freeForm });
    endpoint('/ui/label-groups', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestOf(event).json());
        groups = [seeded, priority([{ id: 'high', displayLabel: 'high' }])];
        freeForm = [];
        return {};
      },
    });
    const labelGroups = useLabelGroupsStore();

    await labelGroups.createLabelGroup({ id: 'priority', displayName: 'Priority', labels: [{ id: 'high', displayLabel: null }] });

    expect(sent).toEqual([{ id: 'priority', displayName: 'Priority', labels: [{ id: 'high', displayLabel: null }] }]);
    expect(labelGroups.labelGroups.map(group => group.id)).toEqual(['triage-category', 'priority']);
    expect(labelGroups.freeFormLabels).toEqual([]);
  });

  it('moving a member down sends the group\'s new member order', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/labels', { method: 'GET', handler: () => ({ items: [seeded, priority([{ id: 'high', displayLabel: 'High' }, { id: 'low', displayLabel: 'Low' }])], nextCursor: null }) });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [] });
    endpoint('/ui/label-groups/priority/labels/order', {
      method: 'PUT', handler: async (event) => {
        sent.push(await requestOf(event).json());
        return {};
      },
    });
    const labelGroups = useLabelGroupsStore();
    await labelGroups.load();

    await labelGroups.moveGroupMember('priority', 'high', 1);

    expect(sent).toEqual([{ labels: ['low', 'high'] }]);
  });

  it('moving an admin group up reorders only the admin groups; the seeded ones stay first', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/labels', { method: 'GET', handler: () => ({ items: [seeded, priority([]), effortGroup], nextCursor: null }) });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [] });
    endpoint('/ui/label-groups/order', {
      method: 'PUT', handler: async (event) => {
        sent.push(await requestOf(event).json());
        return [];
      },
    });
    const labelGroups = useLabelGroupsStore();
    await labelGroups.load();

    await labelGroups.moveLabelGroup('effort-size', -1);

    expect(sent).toEqual([{ groups: ['effort-size', 'priority'] }]);
  });
});
