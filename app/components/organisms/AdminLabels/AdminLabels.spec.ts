import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import { useLabelGroupsStore } from '~/stores/label-groups';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/sessions';
import AdminLabels from './AdminLabels.vue';

const endpoint = useEndpoints();
const seeded = { id: 'triage-category', displayName: 'Category', seeded: true, exclusive: true as const, labels: [{ id: 'bug', displayLabel: 'Bug' }] };
const priority = { id: 'priority', displayName: 'Priority', seeded: false, exclusive: true as const, labels: [{ id: 'high', displayLabel: 'High' }, { id: 'low', displayLabel: 'Low' }] };
const buttonsNamed = (wrapper: VueWrapper, name: string) => wrapper.findAll('button').filter(button => (button.attributes('aria-label') ?? button.text()) === name);

describe('AdminLabels', () => {
  beforeEach(() => {
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
    const labelGroups = useLabelGroupsStore();
    labelGroups.labelGroups = [seeded, priority];
    labelGroups.freeFormLabels = [{ label: 'urgent', count: 3 }];
  });

  it('shows a seeded group read-only with a seeded tag, and names each admin member\'s reorder buttons after the member', async () => {
    const wrapper = await mountSuspended(AdminLabels);

    const seededCard = wrapper.get('[data-group="triage-category"]');
    expect(seededCard.text()).toContain('seeded');
    expect(seededCard.findAll('input, button')).toHaveLength(0);
    expect(buttonsNamed(wrapper, 'Move Low up')).toHaveLength(1);
    expect(buttonsNamed(wrapper, 'Move High down')).toHaveLength(1);
    expect(buttonsNamed(wrapper, 'Remove High')).toHaveLength(1);
    expect(buttonsNamed(wrapper, 'Delete group Priority')).toHaveLength(1);
  });

  it('promoting a free-form label pre-fills Add member on the chosen group and moves focus there', async () => {
    const wrapper = await mountSuspended(AdminLabels, { attachTo: document.body });

    const promote = wrapper.get('select[aria-label="Promote urgent into…"]');
    await promote.setValue('priority');

    const addMember = wrapper.get('[data-group="priority"] input[name="memberId"]');
    expect((addMember.element as HTMLInputElement).value).toBe('urgent');
    await vi.waitFor(() => expect(document.activeElement).toBe(addMember.element));
    wrapper.unmount();
  });

  it('lists the issues of a promotion conflict as links to them', async () => {
    endpoint('/ui/label-groups/priority/labels', { method: 'POST', handler: apiFailure(409, { code: 'conflict', message: '#3, #12 would carry two members of priority', field: 'labels', details: { group: 'priority', issues: [3, 12], truncated: false } }) });
    const wrapper = await mountSuspended(AdminLabels);

    const card = wrapper.get('[data-group="priority"]');
    await card.get('input[name="memberId"]').setValue('urgent');
    await card.get('form.label-group-card__add').trigger('submit');

    await vi.waitFor(() => expect(card.findAll('[role="status"] a').map(link => link.attributes('href'))).toEqual(['/issues/3', '/issues/12']));
  });

  it('shows a reserved group id as an error on the id field', async () => {
    endpoint('/ui/label-groups', { method: 'POST', handler: apiFailure(400, { code: 'invalid', message: 'number is a built-in sort or filter key', field: 'id' }) });
    const wrapper = await mountSuspended(AdminLabels);

    const groupId = wrapper.get('input[name="groupId"]');
    await groupId.setValue('number');
    await wrapper.get('form.new-label-group-form').trigger('submit');

    await vi.waitFor(() => expect(groupId.attributes('aria-invalid')).toBe('true'));
    const message = wrapper.get(`[id="${groupId.attributes('aria-describedby')!.split(' ').at(-1)}"]`);
    expect(message.text()).toBe('number is a built-in sort or filter key');
    expect(message.attributes('role')).toBe('status');
  });

  it('removes a member only after an inline confirmation saying its label stays as a free-form label', async () => {
    const removed: string[] = [];
    endpoint('/ui/label-groups/priority/labels/high', {
      method: 'DELETE', handler: () => {
        removed.push('high');
        return {};
      },
    });
    endpoint('/ui/labels', { method: 'GET', handler: () => [seeded, { ...priority, labels: [priority.labels[1]] }] });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [{ label: 'high', count: 1 }] });
    const wrapper = await mountSuspended(AdminLabels);

    await buttonsNamed(wrapper, 'Remove High')[0]!.trigger('click');
    expect(removed).toEqual([]);
    const confirmation = wrapper.get('[role="group"]');
    expect(confirmation.text()).toContain('Issues keep it as a free-form label.');
    await confirmation.findAll('button')[0]!.trigger('click');

    await vi.waitFor(() => expect(removed).toEqual(['high']));
    await vi.waitFor(() => expect(buttonsNamed(wrapper, 'Remove High')).toHaveLength(0));
  });

  it('keeps a Viewer\'s reorder buttons locked, opening the password prompt instead of moving', async () => {
    useSessionStore().me = viewerSession;
    const wrapper = await mountSuspended(AdminLabels);

    const moveDown = buttonsNamed(wrapper, 'Move High down')[0]!;
    expect(moveDown.attributes('aria-disabled')).toBe('true');
    await moveDown.trigger('click');

    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
  });

  it('keeps the rejected text of a failed rename while the rest of the save syncs in', async () => {
    let groupName = 'Priority';
    endpoint('/ui/label-groups/priority', {
      method: 'PATCH', handler: () => {
        groupName = 'Urgency';
        return {};
      },
    });
    endpoint('/ui/label-groups/priority/labels/high', { method: 'PATCH', handler: apiFailure(400, { code: 'invalid', message: 'displayLabel must be a non-empty string', field: 'displayLabel' }) });
    endpoint('/ui/labels', { method: 'GET', handler: () => [seeded, { ...priority, displayName: groupName }] });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [] });
    const wrapper = await mountSuspended(AdminLabels);

    const card = wrapper.get('[data-group="priority"]');
    await card.get('input[name="displayName"]').setValue('Urgency');
    const highLabel = card.get('input[name="displayLabel-high"]');
    await highLabel.setValue('  ');
    await card.get('form.label-group-card__names').trigger('submit');
    await useLabelGroupsStore().load();

    await vi.waitFor(() => expect(highLabel.attributes('aria-invalid')).toBe('true'));
    expect((highLabel.element as HTMLInputElement).value).toBe('  ');
    expect((card.get('input[name="displayName"]').element as HTMLInputElement).value).toBe('Urgency');
  });

  it('keeps unsaved edits on one card when another card is written, while untouched fields follow the server', async () => {
    const effortSize = { id: 'effort-size', displayName: 'Effort size', seeded: false, exclusive: true as const, labels: [{ id: 'small', displayLabel: 'Small' }] };
    useLabelGroupsStore().labelGroups = [seeded, priority, effortSize];
    endpoint('/ui/label-groups/effort-size/labels', { method: 'POST', handler: () => ({}) });
    endpoint('/ui/labels', { method: 'GET', handler: () => [seeded, { ...priority, labels: [{ id: 'high', displayLabel: 'High' }, { id: 'low', displayLabel: 'Lowest' }] }, { ...effortSize, labels: [...effortSize.labels, { id: 'large', displayLabel: 'Large' }] }] });
    endpoint('/ui/labels/free-form', { method: 'GET', handler: () => [] });
    const wrapper = await mountSuspended(AdminLabels);

    const priorityCard = wrapper.get('[data-group="priority"]');
    await priorityCard.get('input[name="displayName"]').setValue('Prio draft');
    await priorityCard.get('input[name="displayLabel-high"]').setValue('Highest draft');
    const sizeCard = wrapper.get('[data-group="effort-size"]');
    await sizeCard.get('input[name="memberId"]').setValue('large');
    await sizeCard.get('form.label-group-card__add').trigger('submit');

    await vi.waitFor(() => expect(sizeCard.find('input[name="displayLabel-large"]').exists()).toBe(true));
    expect((sizeCard.get('input[name="displayLabel-large"]').element as HTMLInputElement).value).toBe('Large');
    expect((priorityCard.get('input[name="displayName"]').element as HTMLInputElement).value).toBe('Prio draft');
    expect((priorityCard.get('input[name="displayLabel-high"]').element as HTMLInputElement).value).toBe('Highest draft');
    expect((priorityCard.get('input[name="displayLabel-low"]').element as HTMLInputElement).value).toBe('Lowest');
  });

  it('keeps the member move and remove buttons named and focusable, only marked locked, once elevation is dropped', async () => {
    const wrapper = await mountSuspended(AdminLabels);
    expect(buttonsNamed(wrapper, 'Move High down')[0]!.attributes('aria-disabled')).toBeUndefined();

    useSessionStore().me = viewerSession;
    await nextTick();

    for (const name of ['Move High down', 'Move Low up', 'Remove High', 'Remove Low', 'Delete group Priority']) {
      const [button] = buttonsNamed(wrapper, name);
      expect(button?.attributes('aria-disabled')).toBe('true');
      expect(button?.attributes('disabled')).toBeUndefined();
    }
  });

  it('keeps hyphenated group and member ids apart: one rejected rename marks only its own input, and every id is unique', async () => {
    const hyphenated = { id: 'a-b', displayName: 'AB', seeded: false, exclusive: true as const, labels: [{ id: 'c', displayLabel: 'C' }] };
    const plain = { id: 'a', displayName: 'A', seeded: false, exclusive: true as const, labels: [{ id: 'b-c', displayLabel: 'BC' }] };
    useLabelGroupsStore().labelGroups = [seeded, hyphenated, plain];
    endpoint('/ui/label-groups/a/labels/b-c', { method: 'PATCH', handler: apiFailure(400, { code: 'invalid', message: 'displayLabel must be a non-empty string', field: 'displayLabel' }) });
    const wrapper = await mountSuspended(AdminLabels);

    const rejected = wrapper.get('[data-group="a"] input[name="displayLabel-b-c"]');
    await rejected.setValue('  ');
    await wrapper.get('[data-group="a"] form.label-group-card__names').trigger('submit');

    await vi.waitFor(() => expect(rejected.attributes('aria-invalid')).toBe('true'));
    expect(wrapper.get('[data-group="a-b"] input[name="displayLabel-c"]').attributes('aria-invalid')).toBe('false');
    const ids = wrapper.findAll('[id]').map(element => element.attributes('id'));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
