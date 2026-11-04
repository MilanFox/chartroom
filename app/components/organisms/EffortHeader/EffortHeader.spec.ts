import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffortDocument } from '~/types/api';
import { useSessionStore } from '~/stores/session';
import { apiFailure, holderSession, issueFixture, viewerSession } from '~/test/issue-fixture';
import EffortHeader from './EffortHeader.vue';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));
const requestOf = (event: unknown) => (event as { web: { request: Request } }).web.request;

const effort = (overrides: Partial<EffortDocument> = {}): EffortDocument => ({
  ...issueFixture({ number: 1, kind: 'effort', title: 'Agent tracker', parent: null, effort: 1, labels: ['core'], version: 4 }),
  name: 'tracker',
  testInstructions: null,
  statusRollup: { map: null, specs: [], triage: {}, open: 3 },
  linkRollup: { resource: [], artifact: [] },
  map: null,
  specs: [],
  ...overrides,
});

const mountHeader = (overrides: Partial<EffortDocument> = {}, openChildren = 3) =>
  mountSuspended(EffortHeader, { props: { effort: effort(overrides), openChildren } });

describe('EffortHeader', () => {
  beforeEach(() => {
    useSessionStore().me = holderSession;
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('saves the slug with the loaded version in If-Match, trimmed', async () => {
    const sent: { ifMatch: string | null, body: unknown }[] = [];
    endpoint('/ui/issues/1', {
      method: 'PATCH',
      handler: async (event) => {
        const request = requestOf(event);
        sent.push({ ifMatch: request.headers.get('if-match'), body: await request.json() });
        return issueFixture({ number: 1, kind: 'effort' });
      },
    });
    const wrapper = await mountHeader();

    await wrapper.get('button[aria-label="Edit slug"]').trigger('click');
    await wrapper.get('.effort-header__editor--slug input').setValue(' agent-tracker ');
    await wrapper.get('form.effort-header__editor--slug').trigger('submit');

    await vi.waitFor(() => expect(sent).toEqual([{ ifMatch: '"4"', body: { name: 'agent-tracker' } }]));
  });

  it('keeps the typed title on a stale save and names who changed it', async () => {
    endpoint('/ui/issues/1', { method: 'PATCH', handler: apiFailure(409, { code: 'conflict', message: 'issue #1 is at version 5, last written by claude-a at 2026-11-04T09:12:00.000Z', field: 'version', details: { version: 5, lastWrittenBy: 'claude-a', lastWrittenAt: '2026-11-04T09:12:00.000Z' } }) });
    const wrapper = await mountHeader();

    await wrapper.get('button[aria-label="Edit title"]').trigger('click');
    await wrapper.get('input').setValue('My unsaved title');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toMatch(/^Changed by @claude-a at 2026-11-04 \d\d:12, reload to see it\./));
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('My unsaved title');
  });

  it('says when another Effort already uses the slug', async () => {
    endpoint('/ui/issues/1', { method: 'PATCH', handler: apiFailure(409, { code: 'conflict', message: 'name docs is taken by #7', field: 'name' }) });
    const wrapper = await mountHeader();

    await wrapper.get('button[aria-label="Edit slug"]').trigger('click');
    await wrapper.get('.effort-header__editor--slug input').setValue('docs');
    await wrapper.get('form.effort-header__editor--slug').trigger('submit');

    await vi.waitFor(() => expect(wrapper.text()).toContain('Another Effort already uses that slug.'));
  });

  it('warns with the open-children count before closing, and closes on "close anyway"', async () => {
    const closed: unknown[] = [];
    endpoint('/ui/issues/1/close', {
      method: 'POST',
      handler: async (event) => {
        closed.push(await requestOf(event).json());
        return issueFixture({ number: 1, kind: 'effort', state: 'closed', status: 'closed' });
      },
    });
    const wrapper = await mountHeader();

    await wrapper.get('button.effort-header__close-button').trigger('click');

    expect(wrapper.get('[role="alert"]').text()).toContain('3 open issues remain under this Effort.');
    expect(closed).toEqual([]);

    await wrapper.findAll('button').find(button => button.text() === 'Close anyway')!.trigger('click');

    await vi.waitFor(() => expect(closed).toEqual([{}]));
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(false));
  });

  it('shows the slug, tags and creator to a Viewer with no write affordance', async () => {
    useSessionStore().me = viewerSession;
    const wrapper = await mountHeader();

    expect(wrapper.text()).toContain('slug: tracker');
    expect(wrapper.text()).toContain('core');
    expect(wrapper.text()).toContain('created by milan');
    expect(wrapper.findAll('button')).toEqual([]);
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('reads "no slug" for an Effort created without one', async () => {
    const wrapper = await mountHeader({ name: null });

    expect(wrapper.text()).toContain('no slug');
  });
});
