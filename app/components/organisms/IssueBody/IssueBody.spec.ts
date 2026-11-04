import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { useIssuesStore } from '~/stores/issues';
import { useSessionStore } from '~/stores/session';
import { apiFailure, holderSession, issueFixture, viewerSession } from '~/test/issue-fixture';
import IssueBody from './IssueBody.vue';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));

const IssueBodyOfStore = defineComponent(() => {
  const issues = useIssuesStore();
  return () => h(IssueBody, { issue: issues.documents[12]! });
});

const mountBody = async (body = 'First draft') => {
  useIssuesStore().documents[12] = issueFixture({ body });
  return mountSuspended(IssueBodyOfStore);
};

describe('IssueBody', () => {
  beforeEach(() => {
    useSessionStore().me = holderSession;
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('renders the body as markdown with a script tag inert', async () => {
    const wrapper = await mountBody('## Question\n\n<script>window.pwned = true</script>Plain');

    expect(wrapper.get('h2').text()).toBe('Question');
    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.text()).toContain('Plain');
  });

  it('keeps the typed text on a stale save and names who changed it, then reload shows their body', async () => {
    let stored = 'First draft';
    endpoint('/ui/issues/12', { method: 'PATCH', handler: apiFailure(409, { code: 'conflict', message: 'issue #12 is at version 4, last written by claude-a at 2026-11-04T09:12:00.000Z', field: 'version', details: { version: 4, lastWrittenBy: 'claude-a', lastWrittenAt: '2026-11-04T09:12:00.000Z' } }) });
    endpoint('/ui/issues/12', { method: 'GET', handler: () => issueFixture({ body: stored, version: 4 }) });
    const wrapper = await mountBody();

    await wrapper.get('button[aria-label="Edit body"]').trigger('click');
    await wrapper.get('textarea').setValue('My unsaved text');
    stored = 'Their body';
    await wrapper.get('form').trigger('submit');

    const status = wrapper.get('[role="status"]');
    await vi.waitFor(() => expect(status.text()).toMatch(/^Changed by @claude-a at 2026-11-04 \d\d:12, reload to see it\./));
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('My unsaved text');

    await status.get('button').trigger('click');

    await vi.waitFor(() => expect(wrapper.text()).toContain('Their body'));
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('keeps the editor and its text on Esc while the conflict notice shows, naming nobody when the server does not', async () => {
    endpoint('/ui/issues/12', { method: 'PATCH', handler: apiFailure(409, { code: 'conflict', message: 'stale', field: 'version' }) });
    const wrapper = await mountBody();

    await wrapper.get('button[aria-label="Edit body"]').trigger('click');
    await wrapper.get('textarea').setValue('My unsaved text');
    await wrapper.get('form').trigger('submit');
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toMatch(/^Changed by someone else, reload to see it\./));

    await wrapper.get('form').trigger('keydown', { key: 'Escape' });

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('My unsaved text');
  });

  it('saves with the version the editor loaded', async () => {
    const ifMatch: (string | null)[] = [];
    endpoint('/ui/issues/12', {
      method: 'PATCH',
      handler: (event) => {
        ifMatch.push((event as { web: { request: Request } }).web.request.headers.get('if-match'));
        return issueFixture({ body: 'Second draft', version: 4 });
      },
    });
    const wrapper = await mountBody();

    await wrapper.get('button[aria-label="Edit body"]').trigger('click');
    await wrapper.get('textarea').setValue('Second draft');
    await wrapper.get('form').trigger('submit');

    await vi.waitFor(() => expect(wrapper.text()).toContain('Second draft'));
    expect(ifMatch).toEqual(['"3"']);
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('offers a Viewer no edit affordance', async () => {
    useSessionStore().me = viewerSession;
    const wrapper = await mountBody();

    expect(wrapper.find('button').exists()).toBe(false);
  });
});
