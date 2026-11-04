import { describe, expect, it } from 'vitest';
import type { Effort } from '~/types/api';
import { DEFAULT_EFFORT_VIEW, effortsInView, rollupGist, tagsAcross, type EffortSortKey, type SortDirection } from './effort-list';

const effort = (number: number, overrides: Partial<Effort> = {}): Effort => ({
  number,
  name: `effort-${number}`,
  title: `Effort ${number}`,
  state: 'open',
  status: 'open',
  labels: [],
  createdBy: 'milan',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  statusRollup: { map: null, specs: [], triage: {}, open: 0 },
  ...overrides,
});

const numbers = (efforts: Effort[]) => efforts.map(({ number }) => number);

describe('effortsInView', () => {
  it('hides closed Efforts by default and lists the newest first', () => {
    const efforts = [effort(1), effort(4, { state: 'closed', status: 'closed' }), effort(7)];

    expect(numbers(effortsInView(efforts, DEFAULT_EFFORT_VIEW))).toEqual([7, 1]);
    expect(numbers(effortsInView(efforts, { ...DEFAULT_EFFORT_VIEW, showClosed: true }))).toEqual([7, 4, 1]);
  });

  it('searches the number, the title and the slug, ignoring case', () => {
    const efforts = [
      effort(3, { title: 'Agent Tracker v1', name: 'tracker' }),
      effort(12, { title: 'Docs site', name: 'docs' }),
      effort(30, { title: 'CLI', name: 'cli-agent' }),
    ];
    const search = (query: string) => numbers(effortsInView(efforts, { ...DEFAULT_EFFORT_VIEW, query }));

    expect(search('agent')).toEqual([30, 3]);
    expect(search('DOCS')).toEqual([12]);
    expect(search('#3')).toEqual([3]);
    expect(search('12')).toEqual([12]);
    expect(search('  ')).toEqual([30, 12, 3]);
  });

  it('keeps only Efforts carrying every selected tag', () => {
    const efforts = [
      effort(1, { labels: ['client-a', 'frontend'] }),
      effort(2, { labels: ['client-a'] }),
      effort(3, { labels: ['frontend', 'client-a', 'urgent'] }),
    ];
    const tagged = (tags: string[]) => numbers(effortsInView(efforts, { ...DEFAULT_EFFORT_VIEW, tags }));

    expect(tagged(['client-a'])).toEqual([3, 2, 1]);
    expect(tagged(['client-a', 'frontend'])).toEqual([3, 1]);
    expect(tagged(['frontend', 'urgent'])).toEqual([3]);
  });

  describe('sorting', () => {
    const rollup = (open: number) => ({ map: null, specs: [], triage: {}, open });
    const efforts = [
      effort(1, { title: 'beta', status: 'closed', state: 'closed', createdBy: 'zoe', statusRollup: rollup(0) }),
      effort(2, { title: 'Alpha', status: 'blocked', createdBy: 'milan', statusRollup: rollup(9) }),
      effort(3, { title: 'gamma', status: 'open', createdBy: 'agent-a', statusRollup: rollup(4) }),
      effort(4, { title: 'delta', status: 'claimed', createdBy: 'milan', statusRollup: rollup(4) }),
    ];
    const sorted = (sortKey: EffortSortKey, sortDirection: SortDirection = 'ascending') =>
      numbers(effortsInView(efforts, { ...DEFAULT_EFFORT_VIEW, showClosed: true, sortKey, sortDirection }));

    it('sorts by number either way', () => {
      expect(sorted('number')).toEqual([1, 2, 3, 4]);
      expect(sorted('number', 'descending')).toEqual([4, 3, 2, 1]);
    });

    it('sorts by title ignoring case', () => {
      expect(sorted('title')).toEqual([2, 1, 4, 3]);
      expect(sorted('title', 'descending')).toEqual([3, 4, 1, 2]);
    });

    it('sorts by state in workflow order: open, claimed, blocked, closed', () => {
      expect(sorted('status')).toEqual([3, 4, 2, 1]);
      expect(sorted('status', 'descending')).toEqual([1, 2, 4, 3]);
    });

    it('sorts by the open count of the roll-up, the number breaking ties', () => {
      expect(sorted('open')).toEqual([1, 3, 4, 2]);
      expect(sorted('open', 'descending')).toEqual([2, 3, 4, 1]);
    });

    it('sorts by who created the Effort, the number breaking ties', () => {
      expect(sorted('createdBy')).toEqual([3, 2, 4, 1]);
    });
  });
});

describe('tagsAcross', () => {
  it('lists every tag in use once, alphabetically', () => {
    const efforts = [effort(1, { labels: ['urgent', 'client-a'] }), effort(2, { labels: ['client-a', 'Backend'] }), effort(3)];

    expect(tagsAcross(efforts)).toEqual(['Backend', 'client-a', 'urgent']);
  });
});

describe('rollupGist', () => {
  it('reads the open count alone for an Effort with neither map nor specs', () => {
    expect(rollupGist({ map: null, specs: [], triage: { none: 2 }, open: 2 })).toEqual({ open: 2, frontier: null, closedTickets: 0, specTickets: 0 });
  });

  it('adds the Frontier while the map is open and the spec tickets closed out of all', () => {
    const rollup = {
      map: { state: 'open' as const, frontier: 3 },
      specs: [
        { number: 5, tickets: { open: 2, claimed: 1, blocked: 1, closed: 2 } },
        { number: 9, tickets: { open: 1, claimed: 0, blocked: 0, closed: 3 } },
      ],
      triage: {},
      open: 9,
    };

    expect(rollupGist(rollup)).toEqual({ open: 9, frontier: 3, closedTickets: 5, specTickets: 10 });
    expect(rollupGist({ ...rollup, map: { state: 'closed', frontier: 0 } }).frontier).toBeNull();
  });
});
