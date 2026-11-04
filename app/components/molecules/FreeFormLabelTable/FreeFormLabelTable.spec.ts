import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '~/stores/session';
import { viewerSession } from '~/test/sessions';
import FreeFormLabelTable from './FreeFormLabelTable.vue';

const groups = [{ id: 'priority', displayName: 'Priority', seeded: false, exclusive: true as const, labels: [] }];
const labels = [{ label: 'urgent', count: 3 }];

describe('FreeFormLabelTable', () => {
  beforeEach(() => {
    useSessionStore().me = { ...viewerSession, admin: { until: new Date(Date.now() + 3_600_000).toISOString() } };
  });

  it('emits promote with the label and the chosen group', async () => {
    const wrapper = await mountSuspended(FreeFormLabelTable, { props: { labels, groups } });

    await wrapper.get('select[aria-label="Promote urgent into…"]').setValue('priority');

    expect(wrapper.emitted('promote')).toEqual([['urgent', 'priority']]);
  });

  it('hints at creating a group first when there is none to promote into', async () => {
    const wrapper = await mountSuspended(FreeFormLabelTable, { props: { labels, groups: [] } });

    expect(wrapper.find('select').exists()).toBe(false);
    expect(wrapper.text()).toContain('urgent');
    expect(wrapper.findAll('p')).toHaveLength(1);
  });

  it('says so when no free-form label is in use', async () => {
    const wrapper = await mountSuspended(FreeFormLabelTable, { props: { labels: [], groups } });

    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.findAll('p')).toHaveLength(1);
  });
});
