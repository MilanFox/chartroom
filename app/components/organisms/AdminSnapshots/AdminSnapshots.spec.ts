import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import { useAdminStore } from '~/stores/admin';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/sessions';
import AdminSnapshots from './AdminSnapshots.vue';

const endpoint = useEndpoints();
const manual = { name: 'manual-20261104-091500', trigger: 'manual' as const, takenAt: '2026-11-04T09:15:00.000Z', size: 40_960 };
const preMigrate = { name: 'pre-migrate-0003-to-0.2.0-20261101-080000', trigger: 'pre-migrate' as const, takenAt: '2026-11-01T08:00:00.000Z', size: 1_572_864 };
const buttonsNamed = (wrapper: VueWrapper, name: string) => wrapper.findAll('button').filter(button => button.text() === name);
const openList = (wrapper: VueWrapper) => wrapper.get('button[aria-expanded]').trigger('click');

describe('AdminSnapshots', () => {
  beforeEach(() => {
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
  });

  it('lists trigger, time and size under column headers, Download and Delete on every row', async () => {
    useAdminStore().snapshots = [manual, preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots);
    await openList(wrapper);

    expect(wrapper.findAll('thead th').map(header => header.text())).toEqual(['Trigger', 'Time', 'Size', 'Actions']);
    const rows = wrapper.findAll('tbody tr');
    expect(rows[0]!.get('td').text()).toBe('Manual');
    expect(rows[0]!.text()).toContain('40 KB');
    expect(rows[0]!.get('a').attributes('href')).toBe(`/ui/snapshots/${manual.name}`);
    expect(rows[0]!.findAll('button').map(button => button.text())).toEqual(['Delete']);
    expect(rows[1]!.get('td').text()).toBe('Before upgrade');
    expect(rows[1]!.get('a').text()).toBe('Download');
    expect(rows[1]!.findAll('button').map(button => button.text())).toEqual(['Delete']);
  });

  it('shows the total size of the listed Snapshots in the heading', async () => {
    useAdminStore().snapshots = [manual, preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots);

    expect(wrapper.get('h2').text()).toBe('Snapshots · 1.5 MB');
  });

  it('shows no total while the list is hidden', async () => {
    useSessionStore().me = viewerSession;
    useAdminStore().snapshots = null;
    const wrapper = await mountSuspended(AdminSnapshots);

    expect(wrapper.get('h2').text()).toBe('Snapshots');
  });

  it('warns that a pre-migrate Snapshot is the rollback path for its upgrade', async () => {
    useAdminStore().snapshots = [manual, preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots);
    await openList(wrapper);

    await wrapper.findAll('tbody tr')[1]!.get('button').trigger('click');
    const preMigrateMessage = wrapper.get('[role="group"]').text();
    await wrapper.findAll('tbody tr')[0]!.get('button').trigger('click');
    const manualMessage = wrapper.get('[role="group"]').text();

    expect(preMigrateMessage).toContain(`Delete the Snapshot ${preMigrate.name}?`);
    expect(preMigrateMessage).toContain('rollback path for that upgrade');
    expect(manualMessage).not.toContain('rollback');
  });

  it('shows a failed Snapshot as a status message at the button', async () => {
    endpoint('/ui/snapshots', { method: 'POST', handler: apiFailure(500, { code: 'internal', message: 'Snapshot failed: disk full' }) });
    useAdminStore().snapshots = [];
    const wrapper = await mountSuspended(AdminSnapshots);

    const take = buttonsNamed(wrapper, 'Take Snapshot now')[0]!;
    await take.trigger('click');

    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toContain('disk full'));
    expect(take.element.parentElement!.contains(wrapper.get('[role="status"]').element)).toBe(true);
  });

  it('deletes a manual Snapshot only after an inline confirmation', async () => {
    let listed = [manual];
    endpoint('/ui/snapshots', { method: 'GET', handler: () => listed });
    endpoint(`/ui/snapshots/${manual.name}`, {
      method: 'DELETE', handler: () => {
        listed = [];
        return new Response(null, { status: 204 });
      },
    });
    useAdminStore().snapshots = [manual];
    const wrapper = await mountSuspended(AdminSnapshots);
    await openList(wrapper);

    await buttonsNamed(wrapper, 'Delete')[0]!.trigger('click');
    expect(wrapper.get('[role="group"]').text()).toContain(`Delete the Snapshot ${manual.name}?`);
    await buttonsNamed(wrapper, 'Delete')[1]!.trigger('click');

    await vi.waitFor(() => expect(wrapper.text()).toContain('No Snapshots yet.'));
  });

  it('keeps Take Snapshot now locked for a Viewer, opening the password prompt under it', async () => {
    useSessionStore().me = viewerSession;
    useAdminStore().snapshots = null;
    const wrapper = await mountSuspended(AdminSnapshots);

    const take = buttonsNamed(wrapper, 'Take Snapshot now')[0]!;
    expect(take.attributes('aria-disabled')).toBe('true');
    expect(wrapper.text()).toContain('Snapshots need admin elevation.');
    await take.trigger('click');

    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
  });

  it('shows a failed delete on that Snapshot\'s row, next to the confirm controls', async () => {
    endpoint(`/ui/snapshots/${manual.name}`, { method: 'DELETE', handler: apiFailure(500, { code: 'internal', message: 'busy' }) });
    useAdminStore().snapshots = [manual, preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots);
    await openList(wrapper);

    await buttonsNamed(wrapper, 'Delete')[0]!.trigger('click');
    await buttonsNamed(wrapper, 'Delete')[1]!.trigger('click');

    const confirmation = wrapper.get('[role="group"]');
    await vi.waitFor(() => expect(confirmation.get('[role="status"]').text()).toBe('Deleting failed. Try again.'));
  });

  it('keeps the list collapsed behind a toggle named with the count, heading and Take Snapshot now outside it', async () => {
    useAdminStore().snapshots = [manual, preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots);

    const toggle = wrapper.get('button[aria-expanded]');
    const list = wrapper.get(`#${toggle.attributes('aria-controls')}`);
    expect(toggle.text()).toBe('Show 2 Snapshots');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(list.attributes('hidden')).toBeDefined();
    expect(list.find('table').exists()).toBe(true);
    expect(list.text()).not.toContain('Take Snapshot now');
    expect(wrapper.get('h2').text()).toBe('Snapshots · 1.5 MB');

    await toggle.trigger('click');
    expect(toggle.text()).toBe('Hide 2 Snapshots');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(list.attributes('hidden')).toBeUndefined();

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(list.attributes('hidden')).toBeDefined();
  });

  it('names a single Snapshot in the singular', async () => {
    useAdminStore().snapshots = [manual];
    const wrapper = await mountSuspended(AdminSnapshots);

    expect(wrapper.get('button[aria-expanded]').text()).toBe('Show 1 Snapshot');
  });

  it('shows the empty message without a toggle', async () => {
    useAdminStore().snapshots = [];
    const wrapper = await mountSuspended(AdminSnapshots);

    expect(wrapper.text()).toContain('No Snapshots yet.');
    expect(wrapper.find('button[aria-expanded]').exists()).toBe(false);
  });

  it('does not open the list after Take Snapshot now', async () => {
    endpoint('/ui/snapshots', { method: 'POST', handler: () => manual });
    endpoint('/ui/snapshots', { method: 'GET', handler: () => [manual, preMigrate] });
    useAdminStore().snapshots = [preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots);

    await buttonsNamed(wrapper, 'Take Snapshot now')[0]!.trigger('click');

    await vi.waitFor(() => expect(wrapper.get('button[aria-expanded]').text()).toBe('Show 2 Snapshots'));
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('false');
  });

  it('stays open after a delete, Keep returns focus to the row\'s Delete and a delete to Take Snapshot now', async () => {
    let listed = [manual, preMigrate];
    endpoint('/ui/snapshots', { method: 'GET', handler: () => listed });
    endpoint(`/ui/snapshots/${manual.name}`, {
      method: 'DELETE', handler: () => {
        listed = [preMigrate];
        return new Response(null, { status: 204 });
      },
    });
    useAdminStore().snapshots = [manual, preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots, { attachTo: document.body });
    await openList(wrapper);

    const deleteButton = buttonsNamed(wrapper, 'Delete')[0]!;
    await deleteButton.trigger('click');
    await buttonsNamed(wrapper, 'Keep')[0]!.trigger('click');
    await vi.waitFor(() => expect(document.activeElement).toBe(deleteButton.element));

    await deleteButton.trigger('click');
    await buttonsNamed(wrapper, 'Delete')[1]!.trigger('click');

    await vi.waitFor(() => expect(wrapper.get('button[aria-expanded]').text()).toBe('Hide 1 Snapshot'));
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true');
    await vi.waitFor(() => expect(document.activeElement).toBe(buttonsNamed(wrapper, 'Take Snapshot now')[0]!.element));
    wrapper.unmount();
  });
});
