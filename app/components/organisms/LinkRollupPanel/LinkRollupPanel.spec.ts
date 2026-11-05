import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EffortDocument, IssueDocument } from '~/types/api';
import { useSessionStore } from '~/stores/session';
import { issueFixture } from '~/test/issue-fixture';
import { holderSession } from '~/test/sessions';
import LinkRollupPanel from './LinkRollupPanel.vue';

const row = (number: number, overrides: Partial<IssueDocument> = {}) => issueFixture({ number, title: `Issue ${number}`, effort: 1, ...overrides });

const effort: EffortDocument = {
  ...issueFixture({ number: 1, kind: 'effort', title: 'Agent tracker', parent: null, effort: 1 }),
  name: 'tracker',
  testInstructions: null,
  statusRollup: { map: null, specs: [], triage: {}, open: 2 },
  linkRollup: {
    resource: [],
    artifact: [{ url: 'https://example.test/adr', title: 'ADR 0001', type: 'doc', sources: [3, 4] }],
  },
  map: null,
  specs: [],
};

describe('LinkRollupPanel', () => {
  beforeEach(() => {
    useSessionStore().me = holderSession;
  });

  it('links every source to its issue page, a closed source keeping its wording', async () => {
    const wrapper = await mountSuspended(LinkRollupPanel, { props: { effort, rows: [row(3), row(4, { state: 'closed', status: 'closed' })] } });

    const sources = wrapper.get('.link-rollup__sources');
    expect(sources.text()).toBe('from #3, #4 (closed)');
    expect(sources.findAll('a').map(link => [link.attributes('href'), link.text()])).toEqual([['/issues/3', '#3'], ['/issues/4', '#4 (closed)']]);
  });

  it('offers a copy button per Link, named by its title', async () => {
    const wrapper = await mountSuspended(LinkRollupPanel, { props: { effort, rows: [row(3), row(4)] } });

    expect(wrapper.get('.link-rollup__link').get('button').attributes('aria-label')).toBe('Copy link: ADR 0001');
  });
});
