import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import { useAdminStore } from '~/stores/admin';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/sessions';
import AdminEfforts from './AdminEfforts.vue';

const endpoint = useEndpoints();
const transcription = {
  number: 12,
  name: 'local-transcription',
  title: 'Local transcription',
  closedAt: '2026-09-01T10:00:00.000Z',
  lastActivityAt: '2026-09-02T11:30:00.000Z',
  counts: { issues: 14, comments: 32, links: 9, changes: 120, researchNotes: 3 },
};
const tiny = {
  number: 20,
  name: null,
  title: 'Tiny',
  closedAt: '2026-10-01T10:00:00.000Z',
  lastActivityAt: '2026-10-01T10:00:00.000Z',
  counts: { issues: 1, comments: 1, links: 0, changes: 1, researchNotes: 1 },
};
const snapshot = { name: 'pre-delete-local-transcription-2026-11-05T09-00-00-000Z', trigger: 'pre-delete' as const, takenAt: '2026-11-05T09:00:00.000Z', size: 4096 };
const buttonsNamed = (wrapper: VueWrapper, name: string) => wrapper.findAll('button').filter(button => button.text() === name);

describe('AdminEfforts', () => {
  beforeEach(() => {
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
  });

  it('lists each closed Effort with its Slug and contents, and a Delete named after it', async () => {
    useAdminStore().closedEfforts = [transcription, tiny];
    const wrapper = await mountSuspended(AdminEfforts);

    expect(wrapper.get('caption').text()).toBe('Closed Efforts, oldest last activity first');
    expect(wrapper.findAll('thead th').map(header => header.text())).toEqual(['Effort', 'Closed', 'Last activity', 'Contents', 'Actions']);
    const rows = wrapper.findAll('tbody tr');
    expect(rows[0]!.get('th').text()).toMatch(/^#12 Local transcription\s+local-transcription$/);
    expect(rows[0]!.text()).toContain('14 issues, 32 comments, 9 Links, 120 Changes, 3 Research notes');
    expect(rows[1]!.text()).toContain('1 issue, 1 comment, 0 Links, 1 Change, 1 Research note');
    expect(rows.map(row => row.get('button').attributes('aria-label'))).toEqual(['Delete #12 Local transcription (local-transcription)', 'Delete #20 Tiny']);
  });

  it('names the Effort and its counts in the confirm, and Keep returns focus to that row\'s Delete', async () => {
    useAdminStore().closedEfforts = [transcription, tiny];
    const wrapper = await mountSuspended(AdminEfforts, { attachTo: document.body });

    const deleteButton = wrapper.findAll('tbody tr')[0]!.get('button');
    await deleteButton.trigger('click');
    expect(wrapper.get('[role="group"]').text()).toContain('Delete #12 Local transcription (local-transcription) with 14 issues, 32 comments, 9 Links, 120 Changes and 3 Research notes? A Snapshot is taken first; the store is then compacted.');
    await buttonsNamed(wrapper, 'Keep')[0]!.trigger('click');

    expect(wrapper.find('[role="group"]').exists()).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(deleteButton.element));
    wrapper.unmount();
  });

  it('on success drops the row, reloads Snapshots and names the Snapshot taken', async () => {
    let listed = [transcription];
    let snapshots: typeof snapshot[] = [];
    endpoint('/ui/admin/closed-efforts', { method: 'GET', handler: () => listed });
    endpoint('/ui/snapshots', { method: 'GET', handler: () => snapshots });
    endpoint('/ui/efforts', { method: 'GET', handler: () => ({ items: [], nextCursor: null }) });
    endpoint('/ui/instance', () => ({ projectName: 'Chartroom', effortName: { singular: 'Effort', plural: 'Efforts' }, openIssues: 0 }));
    endpoint('/ui/efforts/12', {
      method: 'DELETE', handler: () => {
        listed = [];
        snapshots = [snapshot];
        return { snapshot, deleted: transcription.counts, vacuumed: true };
      },
    });
    useAdminStore().closedEfforts = [transcription];
    const wrapper = await mountSuspended(AdminEfforts);

    await buttonsNamed(wrapper, 'Delete')[0]!.trigger('click');
    await buttonsNamed(wrapper, 'Delete')[1]!.trigger('click');

    await vi.waitFor(() => expect(wrapper.text()).toContain('No closed Efforts.'));
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe(`Deleted #12 Local transcription (local-transcription). Snapshot ${snapshot.name} taken.`));
    expect(useAdminStore().snapshots).toEqual([snapshot]);
  });

  it('shows a failed Snapshot in the confirm and keeps the row', async () => {
    endpoint('/ui/efforts/12', { method: 'DELETE', handler: apiFailure(500, { code: 'internal', message: 'Snapshot failed: disk full' }) });
    useAdminStore().closedEfforts = [transcription];
    const wrapper = await mountSuspended(AdminEfforts);

    await buttonsNamed(wrapper, 'Delete')[0]!.trigger('click');
    await buttonsNamed(wrapper, 'Delete')[1]!.trigger('click');

    const confirmation = wrapper.get('[role="group"]');
    await vi.waitFor(() => expect(confirmation.get('[role="status"]').text()).toBe('Snapshot failed: disk full'));
    expect(wrapper.findAll('tbody th')[0]!.text()).toContain('Local transcription');
  });

  it('says it needs elevation while the list is hidden', async () => {
    useSessionStore().me = viewerSession;
    useAdminStore().closedEfforts = null;
    const wrapper = await mountSuspended(AdminEfforts);

    expect(wrapper.text()).toContain('Closed Efforts need admin elevation.');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('keeps Delete locked without elevation, opening the password prompt under it', async () => {
    useSessionStore().me = viewerSession;
    useAdminStore().closedEfforts = [transcription];
    const wrapper = await mountSuspended(AdminEfforts);

    const deleteButton = buttonsNamed(wrapper, 'Delete')[0]!;
    expect(deleteButton.attributes('aria-disabled')).toBe('true');
    await deleteButton.trigger('click');

    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('with 14 issues');
  });
});
