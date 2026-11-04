import { describe, expect, it } from 'vitest';
import type { IssueDocument, IssueRow } from '~/types/api';
import { issueFixture } from '~/test/issue-fixture';
import { artifactCountOf, countByStatus, decisionTickets, rollupSections, DEFAULT_TICKET_FILTER, NO_ASSIGNEE, ticketFilterOptions, ticketGroups, type TicketFilter } from './dashboard';

const row = (number: number, overrides: Partial<IssueDocument> = {}): IssueRow => issueFixture({ number, title: `Issue ${number}`, effort: 1, ...overrides });

const effort = (specs: number[]) => ({ number: 1, specs: specs.map(number => row(number, { kind: 'spec', parent: 1 })) });

const rows = [
  row(2, { kind: 'map', parent: 1 }),
  row(3, { parent: 2, title: 'Decision about cursors' }),
  row(10, { parent: 5, title: 'Bearer middleware', status: 'claimed', assignee: 'alice', labels: ['ready-for-agent'] }),
  row(11, { parent: 5, title: 'Admin session', status: 'blocked', blockedBy: [{ number: 10, title: 'Issue 10', open: true }] }),
  row(12, { parent: 8, title: 'Admin list UI', state: 'closed', status: 'closed', labels: ['ready-for-agent'] }),
  row(13, { parent: 8, title: 'Rate limit', assignee: 'bob' }),
  row(20, { parent: 1, title: 'Login flickers', labels: ['bug', 'needs-triage'] }),
  row(21, { parent: 1, title: 'Dark mode', state: 'closed', status: 'closed', labels: ['enhancement', 'wontfix'] }),
];

const view = (filter: Partial<TicketFilter>, specs = [5, 8]) =>
  ticketGroups(effort(specs), rows, { ...DEFAULT_TICKET_FILTER, ...filter }).map(group => ({ group: group.spec?.number ?? 'triage', labelled: group.labelled, rows: group.rows.map(({ number }) => number) }));

describe('ticketGroups', () => {
  it('groups spec children under a header per spec, then tickets parented straight to the Effort as triage, leaving the map out', () => {
    expect(view({})).toEqual([
      { group: 5, labelled: true, rows: [10, 11] },
      { group: 8, labelled: true, rows: [12, 13] },
      { group: 'triage', labelled: true, rows: [20, 21] },
    ]);
  });

  it('lists the spec children flat when the Effort has one spec, the triage group keeping its header', () => {
    expect(view({}, [5])).toEqual([
      { group: 5, labelled: false, rows: [10, 11] },
      { group: 'triage', labelled: true, rows: [20, 21] },
    ]);
  });

  it('searches #n and title across every group, ignoring case', () => {
    expect(view({ query: 'admin' })).toEqual([
      { group: 5, labelled: true, rows: [11] },
      { group: 8, labelled: true, rows: [12] },
    ]);
    expect(view({ query: '#20' })).toEqual([{ group: 'triage', labelled: true, rows: [20] }]);
    expect(view({ query: '13' })).toEqual([{ group: 8, labelled: true, rows: [13] }]);
  });

  it('keeps the rows whose status is any of the chosen state chips', () => {
    expect(view({ states: ['claimed', 'closed'] })).toEqual([
      { group: 5, labelled: true, rows: [10] },
      { group: 8, labelled: true, rows: [12] },
      { group: 'triage', labelled: true, rows: [21] },
    ]);
  });

  it('narrows by one label and by one assignee or the unassigned entry', () => {
    expect(view({ label: 'ready-for-agent' })).toEqual([
      { group: 5, labelled: true, rows: [10] },
      { group: 8, labelled: true, rows: [12] },
    ]);
    expect(view({ assignee: 'bob' })).toEqual([{ group: 8, labelled: true, rows: [13] }]);
    expect(view({ assignee: NO_ASSIGNEE, label: 'ready-for-agent' })).toEqual([{ group: 8, labelled: true, rows: [12] }]);
  });

  it('sorts every group by state (open, claimed, blocked, closed) or by title, number breaking ties', () => {
    expect(view({ sort: 'state' })).toEqual([
      { group: 5, labelled: true, rows: [10, 11] },
      { group: 8, labelled: true, rows: [13, 12] },
      { group: 'triage', labelled: true, rows: [20, 21] },
    ]);
    expect(view({ sort: 'title' })).toEqual([
      { group: 5, labelled: true, rows: [11, 10] },
      { group: 8, labelled: true, rows: [12, 13] },
      { group: 'triage', labelled: true, rows: [21, 20] },
    ]);
  });
});

describe('ticketFilterOptions', () => {
  it('offers the labels and assignees carried by spec and triage tickets, sorted', () => {
    expect(ticketFilterOptions(effort([5, 8]), rows)).toEqual({
      labels: ['bug', 'enhancement', 'needs-triage', 'ready-for-agent', 'wontfix'],
      assignees: ['alice', 'bob'],
    });
  });
});

describe('decisionTickets', () => {
  const mapRows = [
    row(2, { kind: 'map', parent: 1 }),
    row(4, { parent: 2, title: 'Research the cursor', state: 'closed', status: 'closed' }),
    row(3, { parent: 2, title: 'Grill the data model', status: 'claimed', assignee: 'alice' }),
    row(6, { parent: 2, title: 'Prototype the cursor view', status: 'blocked', blockedBy: [{ number: 3, title: 'Issue 3', open: true }] }),
    row(10, { parent: 5, title: 'A spec ticket about the cursor' }),
  ];
  const decisions = (query: string, states: TicketFilter['states'] = []) => decisionTickets(2, mapRows, { query, states }).map(({ number }) => number);

  it('lists the map children by number, searched on #n and title and narrowed by state chips', () => {
    expect(decisions('')).toEqual([3, 4, 6]);
    expect(decisions('cursor')).toEqual([4, 6]);
    expect(decisions('#3')).toEqual([3]);
    expect(decisions('cursor', ['blocked'])).toEqual([6]);
  });
});

describe('countByStatus', () => {
  it('counts rows per status, every status present', () => {
    expect(countByStatus([row(3, { status: 'claimed' }), row(4, { status: 'claimed' }), row(5, { status: 'closed', state: 'closed' })]))
      .toEqual({ open: 0, claimed: 2, blocked: 0, closed: 1 });
  });
});

describe('rollupSections', () => {
  const linkRollup = {
    resource: [{ url: 'https://example.test/repo', title: 'Starter repo', type: 'external' as const, sources: [1, 21] }],
    artifact: [
      { url: 'https://example.test/adr', title: 'ADR 0001', type: 'doc' as const, sources: [12, 5] },
      { url: 'https://example.test/branch', title: 'research/cursor', type: 'branch' as const, sources: [3] },
    ],
  };

  it('keeps one entry per URL in each role and lists every source with its closed state', () => {
    expect(rollupSections(linkRollup, { number: 1, state: 'open' }, rows)).toEqual([
      { role: 'resource', links: [{ ...linkRollup.resource[0], sources: [{ number: 1, closed: false }, { number: 21, closed: true }] }] },
      {
        role: 'artifact',
        links: [
          { ...linkRollup.artifact[0], sources: [{ number: 12, closed: true }, { number: 5, closed: false }] },
          { ...linkRollup.artifact[1], sources: [{ number: 3, closed: false }] },
        ],
      },
    ]);
  });

  it('counts a spec Artifact once when the spec or any of its tickets carries it', () => {
    expect(artifactCountOf(8, linkRollup, rows)).toBe(1);
    expect(artifactCountOf(5, linkRollup, rows)).toBe(1);
    expect(artifactCountOf(9, linkRollup, rows)).toBe(0);
  });
});
