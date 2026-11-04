import { describe, expect, it } from 'vitest';
import type { LabelGroup } from '~/types/api';
import { labelRows, parentChoices, safeHref, wayfinderTypeOf } from './issue-fields';

const group = (id: string, members: string[]): LabelGroup => ({
  id,
  displayName: id,
  seeded: true,
  exclusive: true,
  labels: members.map(member => ({ id: member, displayLabel: member })),
});

const groups = [
  group('triage-state', ['needs-triage', 'ready-for-agent']),
  group('wayfinder-type', ['wayfinder:research', 'wayfinder:prototype']),
];

describe('labelRows', () => {
  it('gives each Label group the member the issue carries and leaves the rest as free-form labels', () => {
    expect(labelRows(groups, ['client-a', 'wayfinder:prototype', 'frontend'])).toEqual({
      groups: [
        { group: groups[0], selected: null },
        { group: groups[1], selected: 'wayfinder:prototype' },
      ],
      freeForm: ['client-a', 'frontend'],
    });
  });
});

describe('wayfinderTypeOf', () => {
  it('finds the wayfinder:<type> label for the badge', () => {
    expect(wayfinderTypeOf(['needs-triage', 'wayfinder:grilling'])).toBe('wayfinder:grilling');
    expect(wayfinderTypeOf(['needs-triage'])).toBeNull();
  });
});

describe('parentChoices', () => {
  const containers = [
    { number: 1, kind: 'effort', title: 'Tracker' },
    { number: 2, kind: 'map', title: 'Agent Tracker v1' },
    { number: 19, kind: 'spec', title: 'HTTP API' },
    { number: 30, kind: 'effort', title: 'Docs' },
  ] as const;

  it('offers a ticket every map, spec and Effort, and none', () => {
    expect(parentChoices({ number: 12, kind: 'ticket' }, [...containers])).toEqual({
      choices: [
        { number: 2, kind: 'map', title: 'Agent Tracker v1' },
        { number: 19, kind: 'spec', title: 'HTTP API' },
        { number: 1, kind: 'effort', title: 'Tracker' },
        { number: 30, kind: 'effort', title: 'Docs' },
      ],
      allowsNone: true,
    });
  });

  it('offers a map or spec only Efforts, never none', () => {
    expect(parentChoices({ number: 2, kind: 'map' }, [...containers])).toEqual({
      choices: [
        { number: 1, kind: 'effort', title: 'Tracker' },
        { number: 30, kind: 'effort', title: 'Docs' },
      ],
      allowsNone: false,
    });
  });
});

describe('safeHref', () => {
  it('keeps web and mail targets and refuses script URLs, which the server accepts as absolute', () => {
    expect(safeHref('https://github.com/MilanFox/chartroom/tree/feat/37')).toBe('https://github.com/MilanFox/chartroom/tree/feat/37');
    expect(safeHref('mailto:milan@example.com')).toBe('mailto:milan@example.com');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeNull();
  });
});
