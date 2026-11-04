import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewEffortForm from './NewEffortForm.vue';

const unregister: (() => void)[] = [];
const apiError = (status: number, code: string, field: string) => () =>
  new Response(JSON.stringify({ error: { code, message: code, field } }), { status, headers: { 'content-type': 'application/json' } });

const fill = async (wrapper: Awaited<ReturnType<typeof mountSuspended>>, title: string, slug: string) => {
  const [titleField, slugField] = wrapper.findAll('input');
  await titleField!.setValue(title);
  await slugField!.setValue(slug);
  await wrapper.get('form').trigger('submit');
};

describe('NewEffortForm', () => {
  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('reports a taken slug inline on the slug field', async () => {
    unregister.push(registerEndpoint('/ui/issues', { method: 'POST', handler: apiError(409, 'conflict', 'name') }));
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
    unregister.push(registerEndpoint('/ui/issues', {
      method: 'POST',
      handler: async (event) => {
        sent.push(await (event as { web: { request: Request } }).web.request.json());
        return { number: 7 };
      },
    }));
    unregister.push(registerEndpoint('/ui/efforts', () => ({ items: [], nextCursor: null })));
    unregister.push(registerEndpoint('/ui/instance', () => ({ projectName: 'Chartroom', effortName: { singular: 'Effort', plural: 'Efforts' }, openIssues: 1 })));
    const wrapper = await mountSuspended(NewEffortForm);

    await fill(wrapper, '  Docs site ', ' ');

    await vi.waitFor(() => expect(wrapper.emitted('created')).toEqual([[7]]));
    expect(sent).toEqual([{ kind: 'effort', title: 'Docs site', name: null }]);
  });
});
