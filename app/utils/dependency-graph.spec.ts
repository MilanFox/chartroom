import { describe, expect, it } from 'vitest';
import type { IssueRow, IssueStatus } from '~/types/api';
import { graphProgress, layoutGraph } from './dependency-graph';

// This map's 24 wayfinder tickets with their real `Blocked by:` lines.
const WAYFINDER_MAP = [
  { number: 1, blockedBy: [] },
  { number: 2, blockedBy: [] },
  { number: 3, blockedBy: [2] },
  { number: 4, blockedBy: [2] },
  { number: 5, blockedBy: [] },
  { number: 6, blockedBy: [] },
  { number: 7, blockedBy: [] },
  { number: 8, blockedBy: [4, 7, 15] },
  { number: 9, blockedBy: [3] },
  { number: 10, blockedBy: [4] },
  { number: 11, blockedBy: [5, 6] },
  { number: 12, blockedBy: [] },
  { number: 13, blockedBy: [11] },
  { number: 14, blockedBy: [7] },
  { number: 15, blockedBy: [4, 7] },
  { number: 16, blockedBy: [] },
  { number: 17, blockedBy: [9, 10, 12, 19] },
  { number: 18, blockedBy: [13, 14] },
  { number: 19, blockedBy: [12] },
  { number: 20, blockedBy: [] },
  { number: 21, blockedBy: [] },
  { number: 22, blockedBy: [] },
  { number: 23, blockedBy: [] },
  { number: 24, blockedBy: [] },
];

type Layout = ReturnType<typeof layoutGraph>;

const crossingsOf = (columns: Layout['columns'], edges: Layout['edges']) => {
  const position = new Map(columns.flatMap(column => column.map((slot, index) => [slot.key, index] as const)));
  const segments = edges.flatMap(({ from, to, via }) => {
    const chain = [`${from}`, ...via.map(slot => slot.key), `${to}`];
    return chain.slice(1).map((key, index) => ({ start: chain[index]!, end: key }));
  });
  const layerOf = new Map(columns.flatMap((column, layer) => column.map(slot => [slot.key, layer] as const)));
  let crossings = 0;
  segments.forEach((a, index) => segments.slice(index + 1).forEach((b) => {
    if (layerOf.get(a.start) !== layerOf.get(b.start)) return;
    if ((position.get(a.start)! - position.get(b.start)!) * (position.get(a.end)! - position.get(b.end)!) < 0) crossings += 1;
  }));
  return crossings;
};

const ticketsPerColumn = (layout: ReturnType<typeof layoutGraph>) =>
  layout.columns.map(column => column.flatMap(slot => (slot.ticket === null ? [] : [slot.ticket])).sort((a, b) => a - b));

describe('layoutGraph', () => {
  it('puts each ticket in the layer of its longest blocked-by path from a source', () => {
    expect(ticketsPerColumn(layoutGraph(WAYFINDER_MAP))).toEqual([
      [1, 2, 5, 6, 7, 12, 16, 20, 21, 22, 23, 24],
      [3, 4, 11, 14, 19],
      [9, 10, 13, 15],
      [8, 17, 18],
    ]);
  });

  it('routes every edge spanning more than one layer through one dummy slot per layer it passes', () => {
    const layout = layoutGraph(WAYFINDER_MAP);
    const dummiesPerColumn = layout.columns.map(column => column.filter(slot => slot.ticket === null).map(slot => slot.key).sort());

    expect(dummiesPerColumn).toEqual([
      [],
      ['12-17@1', '7-15@1', '7-8@1'],
      ['12-17@2', '14-18@2', '19-17@2', '4-8@2', '7-8@2'],
      [],
    ]);
    expect(layout.edges.find(edge => edge.from === 7 && edge.to === 8)!.via.map(slot => slot.key)).toEqual(['7-8@1', '7-8@2']);
    expect(layout.edges.find(edge => edge.from === 15 && edge.to === 8)!.via).toEqual([]);
    expect(layout.edges).toHaveLength(20);
  });

  it('orders a layer by the barycenter of its neighbours so crossing edges untangle', () => {
    const crossed = [
      { number: 1, blockedBy: [] },
      { number: 2, blockedBy: [] },
      { number: 3, blockedBy: [2] },
      { number: 4, blockedBy: [1] },
    ];

    expect(layoutGraph(crossed).columns.map(column => column.map(slot => slot.key))).toEqual([['1', '2'], ['4', '3']]);
  });

  it('crosses fewer edges on the map fixture than plain number order does', () => {
    const layout = layoutGraph(WAYFINDER_MAP);
    const numberOrder = layout.columns.map(column => [...column].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })));

    expect(crossingsOf(layout.columns, layout.edges)).toBeLessThan(crossingsOf(numberOrder, layout.edges));
  });

  it('stacks the slots of a column without overlap, cards in columns and edges only in the gutters between them', () => {
    const layout = layoutGraph(WAYFINDER_MAP);

    layout.columns.forEach((column) => {
      column.slice(1).forEach((slot, index) => expect(slot.y).toBeGreaterThanOrEqual(column[index]!.y + column[index]!.height));
      expect(new Set(column.map(slot => slot.x)).size).toBe(1);
    });
    const [first, second] = layout.columns;
    expect(second![0]!.x).toBeGreaterThan(first![0]!.x + layout.nodeWidth);
    layout.edges.forEach(({ via }) => via.forEach(slot => expect(slot.height).toBeLessThan(layout.nodeHeight)));
    expect(layout.width).toBeGreaterThanOrEqual(layout.columns.at(-1)![0]!.x + layout.nodeWidth);
    expect(layout.height).toBeGreaterThanOrEqual(Math.max(...layout.columns.map(column => column.at(-1)!.y + column.at(-1)!.height)));
  });
});

const row = (number: number, status: IssueStatus, assignee: string | null = null): Pick<IssueRow, 'number' | 'status' | 'assignee'> => ({ number, status, assignee });

describe('graphProgress', () => {
  it('counts closed, claimed and blocked children and marks open unclaimed unblocked ones as the Frontier', () => {
    const progress = graphProgress([row(1, 'closed'), row(2, 'closed'), row(3, 'claimed', 'milan'), row(4, 'blocked'), row(5, 'open'), row(6, 'open')]);

    expect(progress).toEqual({ total: 6, closed: 2, claimed: 1, blocked: 1, open: 2, takeable: [5, 6] });
  });
});
