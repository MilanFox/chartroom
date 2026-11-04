import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import VersionedTextEditor from './VersionedTextEditor.vue';

const editorOf = (overrides = {}) => reactive({
  editing: true,
  draft: 'Old title',
  saving: false,
  failed: false,
  failure: null,
  conflict: null,
  open: vi.fn(),
  cancel: vi.fn(),
  save: vi.fn(),
  reload: vi.fn(),
  ...overrides,
}) as never;

describe('VersionedTextEditor', () => {
  it('edits the editor draft and hands save and cancel to the editor', async () => {
    const editor = editorOf();
    const wrapper = await mountSuspended(VersionedTextEditor, { props: { editor, label: 'Title' } });

    await wrapper.get('input').setValue('New title');
    await wrapper.get('form').trigger('submit');
    await wrapper.get('button[type="button"]').trigger('click');

    expect((editor as { draft: string }).draft).toBe('New title');
    expect((editor as { save: unknown }).save).toHaveBeenCalledOnce();
    expect((editor as { cancel: unknown }).cancel).toHaveBeenCalledOnce();
  });

  it('shows the failure message when the save failed', async () => {
    const wrapper = await mountSuspended(VersionedTextEditor, { props: { editor: editorOf({ failed: true }), label: 'Slug', failedMessage: 'Slug is taken' } });

    expect(wrapper.text()).toContain('Slug is taken');
  });
});
