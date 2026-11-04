import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { IssueDocument } from '~/types/api';
import { useIssuesStore } from '~/stores/issues';
import { useSessionStore } from '~/stores/session';
import { holderSession, issueFixture, viewerSession } from '~/test/issue-fixture';
import IssueFields from './IssueFields.vue';

const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));
const requestOf = (event: unknown) => (event as { web: { request: Request } }).web.request;
const noContent = () => new Response(null, { status: 204 });

const labelGroups = [
  { id: 'triage-state', displayName: 'Triage state', seeded: true, exclusive: true, labels: [{ id: 'needs-triage', displayLabel: 'Needs triage' }, { id: 'ready-for-agent', displayLabel: 'Ready for an agent' }] },
];

const IssueFieldsOfStore = defineComponent(() => {
  const issues = useIssuesStore();
  return () => h(IssueFields, { issue: issues.documents[12]! });
});

const mountFields = async (overrides: Partial<IssueDocument> = {}) => {
  let current = issueFixture(overrides);
  endpoint('/ui/labels', () => labelGroups);
  const containers = [{ number: 1, kind: 'effort', title: 'Tracker' }, { number: 2, kind: 'map', title: 'Agent Tracker v1' }];
  endpoint('/ui/issues', (event) => {
    const kind = new URL(requestOf(event).url).searchParams.get('kind');
    return { items: containers.filter(container => container.kind === kind), nextCursor: null };
  });
  endpoint('/ui/issues/12', { method: 'GET', handler: () => current });
  useIssuesStore().documents[12] = current;
  const wrapper = await mountSuspended(IssueFieldsOfStore);
  return { wrapper, serve: (next: Partial<IssueDocument>) => current = issueFixture({ ...overrides, ...next }) };
};

describe('IssueFields', () => {
  beforeEach(() => {
    useSessionStore().me = holderSession;
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('names every sidebar row as a group', async () => {
    const { wrapper } = await mountFields();

    const rowNames = wrapper.findAll('[role="group"]').map(row => wrapper.get(`[id="${row.attributes('aria-labelledby')}"]`).text());

    expect(rowNames).toEqual(['Labels', 'Claim', 'Parent', 'Blocked by', 'Blocks', expect.stringMatching(/^Links/)]);
  });

  it('offers parents labelled by Kind, the Effort under the Instance Effort Display label', async () => {
    const { wrapper } = await mountFields();

    expect(wrapper.get('select:not([id$="-triage-state"])').findAll('option').map(option => option.text())).toEqual(['None', 'Map #2: Agent Tracker v1', 'Effort #1: Tracker']);
  });

  it('picks a Label group member by its Display label, the server replacing the sibling', async () => {
    const put: string[] = [];
    endpoint('/ui/issues/12/labels/ready-for-agent', {
      method: 'PUT', handler: (event) => {
        put.push(requestOf(event).method);
        return noContent();
      }
    });
    const { wrapper, serve } = await mountFields({ labels: ['needs-triage'] });
    const select = wrapper.get('select[id$="-triage-state"]');
    expect(select.findAll('option').map(option => option.text())).toEqual(['None', 'Needs triage', 'Ready for an agent']);

    serve({ labels: ['ready-for-agent'] });
    await select.setValue('ready-for-agent');

    await vi.waitFor(() => expect(put).toEqual(['PUT']));
    await vi.waitFor(() => expect((select.element as HTMLSelectElement).value).toBe('ready-for-agent'));
  });

  it('shows open blockers by number and title and closed ones as a muted #n ✓ chip with the title on hover', async () => {
    const { wrapper } = await mountFields({ blockedBy: [{ number: 6, title: 'Data model', open: false }, { number: 13, title: 'Docker packaging', open: true }] });

    const [closed, open] = wrapper.findAll('li[class*="issue-blockers__blocker"]');

    expect(closed!.classes()).toContain('issue-blockers__blocker--closed');
    expect(closed!.get('a').text()).toBe('#6 ✓');
    expect(closed!.get('a').attributes('title')).toBe('Data model');
    expect(open!.classes()).toContain('issue-blockers__blocker--open');
    expect(open!.get('a').text()).toBe('#13 Docker packaging');
  });

  it('adds a Link with role, type, url and title, marking a UI-made Link manual', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/issues/12/links', {
      method: 'POST', handler: async (event) => {
        sent.push(await requestOf(event).json());
        return {};
      }
    });
    const { wrapper, serve } = await mountFields();
    const form = wrapper.findAll('form').find(candidate => candidate.text().includes('Add Link'))!;

    await form.get('select[id$="-role"]').setValue('artifact');
    await form.get('select[id$="-type"]').setValue('preview');
    await form.get('input[type="url"]').setValue('https://preview.example.com');
    await form.get('input[id$="-title"]').setValue('Preview');
    serve({ links: [{ id: 1, issue: 12, role: 'artifact', type: 'preview', url: 'https://preview.example.com', title: 'Preview', addedBy: 'milan', origin: 'ui', createdAt: '2026-11-04T09:00:00.000Z' }] });
    await form.trigger('submit');

    await vi.waitFor(() => expect(sent).toEqual([{ role: 'artifact', type: 'preview', url: 'https://preview.example.com', title: 'Preview' }]));
    await vi.waitFor(() => expect(wrapper.get('a[href="https://preview.example.com"]').text()).toBe('Preview'));
    expect(wrapper.get('.issue-links__link').text()).toContain('manual');
  });

  it('names the holder when someone else claimed first', async () => {
    endpoint('/ui/issues/12/claim', { method: 'POST', handler: () => new Response(JSON.stringify({ error: { code: 'conflict', message: 'issue #12 is held by claude-b', field: 'assignee' } }), { status: 409, headers: { 'content-type': 'application/json' } }) });
    const { wrapper, serve } = await mountFields();

    serve({ assignee: 'claude-b', status: 'claimed' });
    await wrapper.findAll('button').find(button => button.text() === 'Claim')!.trigger('click');

    await vi.waitFor(() => expect(wrapper.text()).toContain('Already claimed by @claude-b.'));
    await vi.waitFor(() => expect(wrapper.text()).toContain('Claimed by @claude-b'));
  });

  it('gives a Viewer no write affordance', async () => {
    useSessionStore().me = viewerSession;
    const { wrapper } = await mountFields({
      labels: ['needs-triage', 'frontend'],
      blockedBy: [{ number: 13, title: 'Docker packaging', open: true }],
      links: [{ id: 1, issue: 12, role: 'resource', type: 'doc', url: 'https://example.com', title: 'Brief', addedBy: 'claude-a', origin: 'api', createdAt: '2026-11-04T09:00:00.000Z' }],
    });

    expect(wrapper.findAll('button, select, input, textarea, form')).toHaveLength(0);
    expect(wrapper.text()).toContain('Needs triage');
  });
});
