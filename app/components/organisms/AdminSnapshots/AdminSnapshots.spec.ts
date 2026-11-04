import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminStore } from '~/stores/admin';
import { useSessionStore } from '~/stores/session';
import { apiFailure, viewerSession } from '~/test/issue-fixture';
import AdminSnapshots from './AdminSnapshots.vue';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));
const manual = { name: 'manual-20261104-091500', kind: 'manual' as const, takenAt: '2026-11-04T09:15:00.000Z', size: 40_960 };
const preMigrate = { name: 'pre-migrate-0003-to-0.2.0-20261101-080000', kind: 'pre-migrate' as const, takenAt: '2026-11-01T08:00:00.000Z', size: 1_572_864 };
const buttonsNamed = (wrapper: VueWrapper, name: string) => wrapper.findAll('button').filter(button => button.text() === name);

describe('AdminSnapshots', () => {
  beforeEach(() => {
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('lists kind, time and size under column headers, Download on every row and Delete on manual rows only', async () => {
    useAdminStore().snapshots = [manual, preMigrate];
    const wrapper = await mountSuspended(AdminSnapshots);

    expect(wrapper.findAll('thead th').map(header => header.text())).toEqual(['Type', 'Time', 'Size', 'Actions']);
    const rows = wrapper.findAll('tbody tr');
    expect(rows[0]!.get('td').text()).toBe('Manual');
    expect(rows[0]!.text()).toContain('40 KB');
    expect(rows[0]!.get('a').attributes('href')).toBe(`/ui/snapshots/${manual.name}`);
    expect(rows[0]!.findAll('button').map(button => button.text())).toEqual(['Delete']);
    expect(rows[1]!.get('td').text()).toBe('Before upgrade');
    expect(rows[1]!.get('a').text()).toBe('Download');
    expect(rows[1]!.findAll('button')).toHaveLength(0);
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

    await buttonsNamed(wrapper, 'Delete')[0]!.trigger('click');
    await buttonsNamed(wrapper, 'Delete')[1]!.trigger('click');

    const confirmation = wrapper.get('[role="group"]');
    await vi.waitFor(() => expect(confirmation.get('[role="status"]').text()).toBe('Deleting failed. Try again.'));
  });
});
