import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EffortDocument, RolledUpResearchNote } from '~/types/api';
import { useSessionStore } from '~/stores/session';
import { issueFixture } from '~/test/issue-fixture';
import { holderSession } from '~/test/sessions';
import ResearchRollupPanel from './ResearchRollupPanel.vue';

const effortOf = (researchRollup: RolledUpResearchNote[]): EffortDocument => ({
  ...issueFixture({ number: 1, kind: 'effort', title: 'Agent tracker', parent: null, effort: 1 }),
  name: 'tracker',
  testInstructions: null,
  statusRollup: { map: null, specs: [], triage: {}, open: 0 },
  linkRollup: { resource: [], artifact: [] },
  researchRollup,
  map: null,
  specs: [],
});

const rolledUp = (issue: RolledUpResearchNote['issue'], slug: string, title: string): RolledUpResearchNote => ({
  issue,
  slug,
  title,
  size: 4096,
  updatedAt: '2026-11-05T09:00:00.000Z',
  url: `http://localhost/issues/${issue.number}/research/${slug}`,
});

describe('ResearchRollupPanel', () => {
  beforeEach(() => {
    useSessionStore().me = holderSession;
  });

  it('lists every note of the Effort with its title linking to the note page and its producing issue', async () => {
    const effort = effortOf([rolledUp({ number: 12, title: 'Transcription spike', kind: 'ticket' }, 'local-transcription', 'Local transcription')]);
    const wrapper = await mountSuspended(ResearchRollupPanel, { props: { effort } });

    expect(wrapper.get('h2').text()).toContain('Research');
    const row = wrapper.get('.research-rollup__note');
    expect(row.findAll('a').map(link => [link.attributes('href'), link.text()])).toEqual([
      ['/issues/12/research/local-transcription', 'Local transcription'],
      ['/issues/12', '#12 Transcription spike'],
    ]);
    expect(row.text()).toMatch(/from #12 Transcription spike\s+· updated 2026-11-05/);
    expect(row.get('button').attributes('aria-label')).toBe('Copy link: Local transcription');
  });

  it('links a note on the Effort itself to the Dashboard', async () => {
    const effort = effortOf([rolledUp({ number: 1, title: 'Agent tracker', kind: 'effort' }, 'survey', 'Survey')]);
    const wrapper = await mountSuspended(ResearchRollupPanel, { props: { effort } });

    expect(wrapper.get('.research-rollup__source').attributes('href')).toBe('/efforts/1');
  });

  it('says so when the Effort holds no notes', async () => {
    const wrapper = await mountSuspended(ResearchRollupPanel, { props: { effort: effortOf([]) } });

    expect(wrapper.find('li').exists()).toBe(false);
    expect(wrapper.get('.research-rollup__none').text()).toMatch(/^No Research notes in this .+ yet\.$/);
  });
});
