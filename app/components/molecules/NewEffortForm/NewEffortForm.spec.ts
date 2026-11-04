import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import NewEffortForm from './NewEffortForm.vue';
import { apiFailure, requestOf, useEndpoints } from '~/test/endpoints';

const endpoint = useEndpoints();

const fill = async (wrapper: Awaited<ReturnType<typeof mountSuspended>>, title: string, slug: string) => {
  const [titleField, slugField] = wrapper.findAll('input');
  await titleField!.setValue(title);
  await slugField!.setValue(slug);
  await wrapper.get('form').trigger('submit');
};

describe('NewEffortForm', () => {
  it('reports a taken slug inline on the slug field', async () => {
    endpoint('/ui/issues', { method: 'POST', handler: apiFailure(409, { code: 'conflict', message: 'conflict', field: 'name' }) });
    const wrapper = await mountSuspended(NewEffortForm);

    await fill(wrapper, 'Docs site', 'docs');

    const slugField = wrapper.get('input[name="slug"]');
    await vi.waitFor(() => expect(slugField.attributes('aria-invalid')).toBe('true'));
    const describedBy = slugField.attributes('aria-describedby')!.split(' ');
    expect(describedBy.map(id => wrapper.find(`[id="${id}"]`).text())).toContain('Another Effort already uses that slug.');
    expect(wrapper.emitted('created')).toBeUndefined();
  });

  it('creates the Effort, leaving the slug out when blank, and hands its number back', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/issues', {
      method: 'POST',
      handler: async (event) => {
        sent.push(await requestOf(event).json());
        return { number: 7 };
      },
    });
    endpoint('/ui/efforts', () => ({ items: [], nextCursor: null }));
    endpoint('/ui/instance', () => ({ projectName: 'Chartroom', effortName: { singular: 'Effort', plural: 'Efforts' }, openIssues: 1 }));
    const wrapper = await mountSuspended(NewEffortForm);

    await fill(wrapper, '  Docs site ', ' ');

    await vi.waitFor(() => expect(wrapper.emitted('created')).toEqual([[7]]));
    expect(sent).toEqual([{ kind: 'effort', title: 'Docs site', name: null }]);
  });
});
