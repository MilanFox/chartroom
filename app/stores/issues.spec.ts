import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IssueDocument } from '~/types/api';
import { issueFixture } from '~/test/issue-fixture';
import { versionConflictOf } from '~/utils/conflict';
import { useIssuesStore } from './issues';

const issue = (overrides: Partial<IssueDocument> = {}) => issueFixture({ origin: 'ui', ...overrides });

type TestEvent = { web: { request: Request } };
const requestOf = (event: unknown) => (event as TestEvent).web.request;
const unregister: (() => void)[] = [];
const endpoint = (...args: Parameters<typeof registerEndpoint>) => unregister.push(registerEndpoint(...args));

describe('useIssuesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('saves a field with If-Match carrying the version the editor loaded', async () => {
    const sent: { ifMatch: string | null, body: unknown }[] = [];
    endpoint('/ui/issues/12', {
      method: 'PATCH',
      handler: async (event) => {
        const request = requestOf(event);
        sent.push({ ifMatch: request.headers.get('if-match'), body: await request.json() });
        return issue({ body: 'Second draft', version: 4 });
      },
    });
    const issues = useIssuesStore();

    await issues.edit(12, { body: 'Second draft' }, 3);

    expect(sent).toEqual([{ ifMatch: '"3"', body: { body: 'Second draft' } }]);
    expect(issues.documents[12]?.body).toBe('Second draft');
  });

  it('rejects a stale save with the conflict naming the other holder and keeps the loaded document', async () => {
    endpoint('/ui/issues/12', () => issue());
    endpoint('/ui/issues/12', {
      method: 'PATCH',
      handler: () => new Response(
        JSON.stringify({ error: { code: 'conflict', message: 'issue #12 is at version 4, last written by claude-a at 2026-11-04T09:12:00.000Z', field: 'version', details: { version: 4, lastWrittenBy: 'claude-a', lastWrittenAt: '2026-11-04T09:12:00.000Z' } } }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    });
    const issues = useIssuesStore();
    await issues.load(12);

    const failure = await issues.edit(12, { body: 'Mine' }, 3).catch(error => error);

    expect(versionConflictOf(failure)).toEqual({ holder: 'claude-a', at: '2026-11-04T09:12:00.000Z' });
    expect(issues.documents[12]?.body).toBe('First draft');
  });

  it('re-reads the document after a write that answers with no content, so a group label shows its sibling gone', async () => {
    let labels = ['needs-triage'];
    endpoint('/ui/issues/12', () => issue({ labels }));
    endpoint('/ui/issues/12/labels/ready-for-agent', {
      method: 'PUT',
      handler: () => {
        labels = ['ready-for-agent'];
        return new Response(null, { status: 204 });
      },
    });
    const issues = useIssuesStore();
    await issues.load(12);

    await issues.addLabel(12, 'ready-for-agent');

    expect(issues.documents[12]?.labels).toEqual(['ready-for-agent']);
  });

  it('closes with the Resolution comment, leaving the comment out when blank', async () => {
    const sent: unknown[] = [];
    endpoint('/ui/issues/12/close', {
      method: 'POST',
      handler: async (event) => {
        sent.push(await requestOf(event).json());
        return issue({ state: 'closed', status: 'closed' });
      },
    });
    const issues = useIssuesStore();

    await issues.close(12, 'Shipped in !4');
    await issues.close(12, '   ');

    expect(sent).toEqual([{ comment: 'Shipped in !4' }, {}]);
    expect(issues.documents[12]?.state).toBe('closed');
  });

  it('collects every map, spec and Effort as a parent candidate, following each cursor', async () => {
    endpoint('/ui/issues', (event) => {
      const query = new URL(requestOf(event).url).searchParams;
      const rows = {
        effort: [{ number: 1, kind: 'effort', title: 'Tracker' }],
        map: [{ number: 2, kind: 'map', title: 'Agent Tracker v1' }],
        spec: query.get('cursor') ? [{ number: 25, kind: 'spec', title: 'CLI' }] : [{ number: 19, kind: 'spec', title: 'HTTP API' }],
      }[query.get('kind') as 'effort' | 'map' | 'spec'];
      const nextCursor = query.get('kind') === 'spec' && !query.get('cursor') ? 'more' : null;
      return { items: rows, nextCursor };
    });
    const issues = useIssuesStore();

    await issues.loadParentCandidates();

    expect(issues.parentCandidates.map(({ number }) => number)).toEqual([1, 2, 19, 25]);
  });

  it('bumps its revision on writes and not on reads', async () => {
    endpoint('/ui/issues/12', () => issue());
    endpoint('/ui/issues/12/claim', { method: 'POST', handler: () => issue() });
    endpoint('/ui/issues/12/labels/bug', { method: 'PUT', handler: () => ({}) });
    endpoint('/ui/issues/12/changes', () => ({ items: [], nextCursor: null }));
    endpoint('/ui/issues', () => ({ items: [], nextCursor: null }));
    const issues = useIssuesStore();

    await issues.load(12);
    await issues.loadChanges(12);
    await issues.loadChildren(12);
    await issues.loadParentCandidates();
    expect(issues.revision).toBe(0);

    await issues.claim(12);
    expect(issues.revision).toBe(1);
    await issues.addLabel(12, 'bug');
    expect(issues.revision).toBe(2);
  });
});
