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
  researchRollup: [],
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

  it('shows a name-only branch Link and a relative file Link as text and an absolute URL as a link', async () => {
    const linkRollup = {
      resource: [], artifact: [
        { url: 'prototype/auth', title: 'Prototype', type: 'branch' as const, sources: [3] },
        { url: 'docs/adr/0003-x.md', title: 'ADR', type: 'file' as const, sources: [3] },
        { url: 'https://example.test/adr', title: 'ADR 0001', type: 'doc' as const, sources: [3] },
      ]
    };
    const wrapper = await mountSuspended(LinkRollupPanel, { props: { effort: { ...effort, linkRollup }, rows: [row(3)] } });

    const [branch, file, absolute] = wrapper.findAll('.link-rollup__link');
    expect(branch!.get('.link-rollup__target').find('a').exists()).toBe(false);
    expect(branch!.get('.link-rollup__url').text()).toBe('prototype/auth');
    expect(file!.get('.link-rollup__target').find('a').exists()).toBe(false);
    expect(file!.get('.link-rollup__url').text()).toBe('docs/adr/0003-x.md');
    expect(absolute!.get('.link-rollup__target a').attributes('href')).toBe('https://example.test/adr');
  });

  it('offers a copy button per Link, named by its title', async () => {
    const wrapper = await mountSuspended(LinkRollupPanel, { props: { effort, rows: [row(3), row(4)] } });

    expect(wrapper.get('.link-rollup__link').get('button').attributes('aria-label')).toBe('Copy link: ADR 0001');
  });
});
