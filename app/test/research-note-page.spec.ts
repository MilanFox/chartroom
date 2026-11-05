import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { apiFailure, useEndpoints } from '~/test/endpoints';
import type { ResearchNote } from '~/types/api';
import ResearchNotePage from '~/pages/issues/[number]/research/[slug].vue';
import { issueFixture } from '~/test/issue-fixture';
import { holderSession } from '~/test/sessions';

const endpoint = useEndpoints();

const noteOf = (body: string, overrides: Partial<ResearchNote> = {}): ResearchNote => ({
  issue: 12,
  slug: 'local-transcription',
  title: 'Local transcription',
  size: 3072,
  createdAt: '2026-11-04T09:00:00.000Z',
  createdBy: 'claude-a',
  updatedAt: '2026-11-05T09:00:00.000Z',
  updatedBy: 'claude-b',
  origin: 'api',
  url: 'http://localhost/issues/12/research/local-transcription',
  body,
  ...overrides,
});

const serveParents = () => {
  endpoint('/ui/me', () => holderSession);
  endpoint('/ui/issues', () => ({ items: [], nextCursor: null }));
};

const mountNote = async (note: ResearchNote) => {
  serveParents();
  endpoint('/ui/issues/12', () => issueFixture({ title: 'Transcription spike' }));
  endpoint(`/ui/issues/12/research/${note.slug}`, () => note);
  return mountSuspended(ResearchNotePage, { route: `/issues/12/research/${note.slug}` });
};

describe('Research note page', () => {
  it('shows the note title as the one h1, its address, size, author and a copy button naming the note', async () => {
    const wrapper = await mountNote(noteOf('# Local transcription\n\n## Findings\n\nWhisper runs locally.'));

    expect(wrapper.findAll('h1').map(heading => heading.text())).toEqual(['Local transcription']);
    expect(wrapper.get('h2').text()).toBe('Findings');
    const meta = wrapper.get('.research-note__meta');
    expect(meta.text()).toContain('#12/local-transcription');
    expect(meta.text()).toContain('3 KB');
    expect(meta.text()).toMatch(/updated 2026-11-05 \d\d:\d\d by claude-b/);
    expect(meta.get('button').attributes('aria-label')).toBe('Copy link: Local transcription');
  });

  it('renders the body as sanitized markdown, a script and an onerror attribute never reaching the DOM', async () => {
    const wrapper = await mountNote(noteOf('# Hostile\n\n<img src="x.png" onerror="window.pwned = true">\n\n<script>window.pwned = true</script>\n\n| Model | Speed |\n| --- | --- |\n| small | fast |', { slug: 'hostile', title: 'Hostile' }));

    const body = wrapper.get('.research-note__body');
    expect(body.find('script').exists()).toBe(false);
    expect(body.get('img').attributes('onerror')).toBeUndefined();
    expect(body.html()).not.toContain('onerror');
    expect(body.findAll('th').map(cell => cell.text())).toEqual(['Model', 'Speed']);
  });

  it('shows the missing line as an alert when the note does not exist', async () => {
    serveParents();
    endpoint('/ui/issues/12', () => issueFixture());
    endpoint('/ui/issues/12/research/gone', apiFailure(404, { code: 'not-found', message: 'research note #12/gone does not exist' }));
    const wrapper = await mountSuspended(ResearchNotePage, { route: '/issues/12/research/gone' });

    expect(wrapper.get('[role="alert"]').text()).toBe('There is no Research note #12/gone.');
    expect(wrapper.find('h1').exists()).toBe(false);
  });
});
