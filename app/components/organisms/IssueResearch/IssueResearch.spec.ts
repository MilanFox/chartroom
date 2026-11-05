import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEndpoints } from '~/test/endpoints';
import type { ResearchNoteSummary } from '~/types/api';
import { useSessionStore } from '~/stores/session';
import { issueFixture } from '~/test/issue-fixture';
import { holderSession } from '~/test/sessions';
import IssueResearch from './IssueResearch.vue';

const endpoint = useEndpoints();

const noteSummary = (overrides: Pick<ResearchNoteSummary, 'issue' | 'slug' | 'title'> & Partial<ResearchNoteSummary>): ResearchNoteSummary => ({
  size: 2048,
  createdAt: '2026-11-04T09:00:00.000Z',
  createdBy: 'claude-a',
  updatedAt: '2026-11-05T09:00:00.000Z',
  updatedBy: 'claude-a',
  origin: 'api',
  url: `http://localhost/issues/${overrides.issue}/research/${overrides.slug}`,
  ...overrides,
});

const mountResearch = async (number: number, notes: ResearchNoteSummary[]) => {
  endpoint(`/ui/issues/${number}/research`, () => ({ items: notes, nextCursor: null }));
  return mountSuspended(IssueResearch, { props: { issue: issueFixture({ number }) } });
};

describe('IssueResearch', () => {
  beforeEach(() => {
    useSessionStore().me = holderSession;
  });

  it('lists every note under its heading, the title linking to the note page with size and updated date', async () => {
    const wrapper = await mountResearch(12, [noteSummary({ issue: 12, slug: 'local-transcription', title: 'Local transcription' }), noteSummary({ issue: 12, slug: 'audit', title: 'Audit', size: 512 })]);

    expect(wrapper.get('h3').text()).toBe('Research notes');
    const rows = wrapper.findAll('li');
    expect(rows.map(row => [row.get('a').attributes('href'), row.get('a').text()])).toEqual([
      ['/issues/12/research/local-transcription', 'Local transcription'],
      ['/issues/12/research/audit', 'Audit'],
    ]);
    expect(rows[0]!.text()).toContain('2 KB · updated 2026-11-05');
    expect(rows[1]!.text()).toContain('512 B');
  });

  it('offers a copy button per note, named by its title', async () => {
    const wrapper = await mountResearch(13, [noteSummary({ issue: 13, slug: 'audit', title: 'Audit' })]);

    expect(wrapper.get('li').get('button').attributes('aria-label')).toBe('Copy link: Audit');
  });

  it('renders nothing when the issue holds no notes', async () => {
    const wrapper = await mountResearch(14, []);

    expect(wrapper.find('[role="group"]').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });
});
