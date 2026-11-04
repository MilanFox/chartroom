import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { IssueChange, IssueComment, IssueDocument } from '~/types/api';
import { useIssuesStore } from '~/stores/issues';
import { useSessionStore } from '~/stores/session';
import { holderSession, issueFixture, viewerSession } from '~/test/issue-fixture';
import IssueCloseForm from '../IssueCloseForm/IssueCloseForm.vue';
import IssueThread from './IssueThread.vue';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));
const requestOf = (event: unknown) => (event as { web: { request: Request } }).web.request;

const comment = (id: number, overrides: Partial<IssueComment> = {}): IssueComment => ({
  id,
  issue: 12,
  author: 'milan',
  body: `Comment ${id}`,
  origin: 'ui',
  resolution: false,
  createdAt: '2026-11-04T09:00:00.000Z',
  updatedAt: '2026-11-04T09:00:00.000Z',
  url: `http://localhost/issues/12#comment-${id}`,
  ...overrides,
});

const change = (id: number, at: string, overrides: Partial<IssueChange> = {}): IssueChange => ({
  id,
  issue: 12,
  actor: 'milan',
  origin: 'ui',
  at,
  field: 'title',
  before: 'A',
  after: 'B',
  ...overrides,
});

const DocumentEnd = defineComponent(() => {
  const issues = useIssuesStore();
  return () => [h(IssueThread, { issue: issues.documents[12]! }), h(IssueCloseForm, { issue: issues.documents[12]! })];
});

const mountThread = async (overrides: Partial<IssueDocument> = {}, changes: IssueChange[] = []) => {
  let current = issueFixture(overrides);
  endpoint('/ui/issues/12', { method: 'GET', handler: () => current });
  endpoint('/ui/issues/12/changes', { method: 'GET', handler: () => ({ items: changes, nextCursor: null }) });
  useIssuesStore().documents[12] = current;
  useIssuesStore().changes = {};
  const wrapper = await mountSuspended(DocumentEnd);
  return { wrapper, serve: (next: Partial<IssueDocument>) => current = issueFixture({ ...overrides, ...next }) };
};

const articles = (wrapper: Awaited<ReturnType<typeof mountThread>>['wrapper']) => wrapper.findAll('article');

describe('IssueThread', () => {
  beforeEach(() => {
    useSessionStore().me = holderSession;
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
    localStorage.clear();
  });

  it('marks UI-made comments manual, API-made ones not, and offers edit and delete on own comments only', async () => {
    const { wrapper } = await mountThread({ comments: [comment(1, { author: 'claude-a', origin: 'api' }), comment(2)] });

    const [agent, own] = articles(wrapper);

    expect(agent!.text()).not.toContain('manual');
    expect(agent!.findAll('button')).toHaveLength(0);
    expect(own!.text()).toContain('manual');
    expect(own!.findAll('button').map(button => button.text())).toEqual(['Edit', 'Delete']);
  });

  it('posts a comment and edits it inline', async () => {
    const posted: unknown[] = [];
    const edited: unknown[] = [];
    endpoint('/ui/issues/12/comments', {
      method: 'POST', handler: async (event) => {
        posted.push(await requestOf(event).json());
        return comment(5, { body: 'Looks right' });
      }
    });
    endpoint('/ui/issues/12/comments/5', {
      method: 'PATCH', handler: async (event) => {
        edited.push(await requestOf(event).json());
        return comment(5, { body: 'Looks right to me' });
      }
    });
    const { wrapper, serve } = await mountThread();

    await wrapper.get('textarea').setValue('Looks right');
    serve({ comments: [comment(5, { body: 'Looks right' })] });
    await wrapper.get('form').trigger('submit');
    await vi.waitFor(() => expect(articles(wrapper)).toHaveLength(1));
    expect(posted).toEqual([{ body: 'Looks right' }]);

    await articles(wrapper)[0]!.findAll('button').find(button => button.text() === 'Edit')!.trigger('click');
    await articles(wrapper)[0]!.get('textarea').setValue('Looks right to me');
    serve({ comments: [comment(5, { body: 'Looks right to me', updatedAt: '2026-11-04T10:00:00.000Z' })] });
    await articles(wrapper)[0]!.get('form').trigger('submit');

    await vi.waitFor(() => expect(articles(wrapper)[0]!.text()).toContain('Looks right to me'));
    expect(edited).toEqual([{ body: 'Looks right to me' }]);
    expect(articles(wrapper)[0]!.find('textarea').exists()).toBe(false);
  });

  it('closes with a Resolution comment, marks it in the thread and offers Reopen', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/issues/12/close', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestOf(event).json());
        return issueFixture({ state: 'closed', status: 'closed', closedAt: '2026-11-04T10:00:00.000Z', comments: [comment(7, { body: 'Merged in !12', resolution: true })] });
      }
    });
    const { wrapper } = await mountThread();

    const closeForm = wrapper.findAll('form').find(form => form.text().includes('Close with resolution'))!;
    await closeForm.get('textarea').setValue('Merged in !12');
    await closeForm.trigger('submit');

    await vi.waitFor(() => expect(wrapper.findAll('button').map(button => button.text())).toContain('Reopen'));
    expect(sent).toEqual([{ comment: 'Merged in !12' }]);
    expect(articles(wrapper)[0]!.classes()).toContain('comment-item--resolution');
    expect(articles(wrapper)[0]!.text()).toContain('Resolution');
  });

  it('interleaves merged Change rows with the comments, diffs the body on demand, and hides the rows behind the remembered toggle', async () => {
    const { wrapper } = await mountThread({ comments: [comment(1, { createdAt: '2026-11-04T09:05:00.000Z' })] }, [
      change(1, '2026-11-04T09:00:00.000Z', { field: 'title', before: 'Issue view', after: 'Issue page' }),
      change(2, '2026-11-04T09:01:00.000Z', { field: 'body', before: 'First draft', after: 'First draft\nSecond line' }),
      change(3, '2026-11-04T09:02:00.000Z', { field: 'body', before: 'First draft\nSecond line', after: 'Second line' }),
      change(4, '2026-11-04T09:10:00.000Z', { actor: 'claude-a', origin: 'api', field: 'label', before: null, after: 'needs-info' }),
    ]);

    await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(3));
    const [edits, commentEntry, relabel] = wrapper.findAll('li');
    expect(edits!.text()).toContain('milan');
    expect(edits!.text()).toContain('changed the title');
    expect(edits!.text()).toContain('edited the body');
    expect(edits!.text()).toContain('manual');
    expect(commentEntry!.find('article').exists()).toBe(true);
    expect(relabel!.text()).toContain('claude-a');
    expect(relabel!.text()).toContain('added needs-info');
    expect(relabel!.findAll('button')).toHaveLength(0);

    const expanders = edits!.findAll('button');
    expect(expanders.map(button => button.text())).toEqual(['Show diff', 'Show diff']);
    await expanders[1]!.trigger('click');
    expect(edits!.findAll('del').map(line => line.text())).toEqual(['removed First draft']);
    expect(edits!.findAll('ins').map(line => line.text())).toEqual(['added Second line']);
    expect(expanders[1]!.attributes('aria-expanded')).toBe('true');

    const toggle = wrapper.get('[role="switch"]');
    expect(toggle.text()).toBe('Show changes');
    expect(toggle.attributes('aria-checked')).toBe('true');
    await toggle.trigger('click');
    expect(wrapper.findAll('li')).toHaveLength(1);
    expect(localStorage.getItem('chartroom:show-changes')).toBe('false');
  });

  it('shows a Viewer the sign-in line in place of the comment box and no close form', async () => {
    useSessionStore().me = viewerSession;
    const { wrapper } = await mountThread({ comments: [comment(1)] });

    expect(wrapper.text()).toContain('Sign in as a Token holder to comment');
    expect(wrapper.findAll('button:not([role="switch"]), textarea, form')).toHaveLength(0);
  });
});
