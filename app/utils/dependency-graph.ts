import type { IssueRow } from '~/types/api';
import { countByStatus } from './dashboard';

export interface GraphTicket {
  number: number
  blockedBy: number[]
}

export interface GraphSlot {
  key: string
  layer: number
  ticket: number | null
  x: number
  y: number
  height: number
}

export interface GraphEdge {
  from: number
  to: number
  via: GraphSlot[]
  path: string
}

const SWEEPS = 2;
const NODE_WIDTH = 184;
const NODE_HEIGHT = 48;
const DUMMY_HEIGHT = 8;
const GUTTER = 64;
const ROW_GAP = 12;
const PADDING = 8;

const slotOf = (key: string, layer: number, ticket: number | null): GraphSlot =>
  ({ key, layer, ticket, x: PADDING + layer * (NODE_WIDTH + GUTTER), y: 0, height: ticket === null ? DUMMY_HEIGHT : NODE_HEIGHT });

interface Point {
  x: number
  y: number
}

const curve = (from: Point, to: Point) => `C${from.x + GUTTER / 2},${from.y} ${to.x - GUTTER / 2},${to.y} ${to.x},${to.y}`;

export const layoutGraph = (tickets: GraphTicket[]) => {
  const shown = new Map(tickets.map(ticket => [ticket.number, ticket]));
  const blockersOf = (ticket: GraphTicket) => ticket.blockedBy.filter(blocker => shown.has(blocker));
  const layerOf = new Map<number, number>();
  const assignLayer = (ticket: GraphTicket): number => {
    const known = layerOf.get(ticket.number);
    if (known !== undefined) return known;
    const layer = Math.max(-1, ...blockersOf(ticket).map(blocker => assignLayer(shown.get(blocker)!))) + 1;
    layerOf.set(ticket.number, layer);
    return layer;
  };

  const columns: GraphSlot[][] = [];
  const place = (slot: GraphSlot) => (columns[slot.layer] ??= []).push(slot);
  const byNumber = [...tickets].sort((a, b) => a.number - b.number);
  byNumber.forEach(ticket => place(slotOf(`${ticket.number}`, assignLayer(ticket), ticket.number)));

  const routes = byNumber.flatMap(ticket => [...blockersOf(ticket)].sort((a, b) => a - b).map((blocker) => {
    const via: GraphSlot[] = [];
    for (let layer = layerOf.get(blocker)! + 1; layer < layerOf.get(ticket.number)!; layer++) {
      const dummy = slotOf(`${blocker}-${ticket.number}@${layer}`, layer, null);
      place(dummy);
      via.push(dummy);
    }
    return { from: blocker, to: ticket.number, via };
  }));

  const neighbours = { before: new Map<string, string[]>(), after: new Map<string, string[]>() };
  const link = (from: string, to: string) => {
    neighbours.after.set(from, [...neighbours.after.get(from) ?? [], to]);
    neighbours.before.set(to, [...neighbours.before.get(to) ?? [], from]);
  };
  routes.forEach(({ from, to, via }) => {
    const chain = [`${from}`, ...via.map(slot => slot.key), `${to}`];
    chain.slice(1).forEach((key, index) => link(chain[index]!, key));
  });

  const orderBy = (layer: number, reference: GraphSlot[], side: Map<string, string[]>) => {
    const indexOf = new Map(reference.map((slot, index) => [slot.key, index]));
    const column = columns[layer]!;
    const barycenter = new Map(column.map((slot, index) => {
      const linked = side.get(slot.key) ?? [];
      return [slot.key, linked.length ? linked.reduce((sum, key) => sum + indexOf.get(key)!, 0) / linked.length : index];
    }));
    column.sort((a, b) => barycenter.get(a.key)! - barycenter.get(b.key)!);
  };
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let layer = 1; layer < columns.length; layer++) orderBy(layer, columns[layer - 1]!, neighbours.before);
    for (let layer = columns.length - 2; layer >= 0; layer--) orderBy(layer, columns[layer + 1]!, neighbours.after);
  }

  columns.forEach(column => column.reduce((y, slot) => {
    slot.y = y;
    return y + slot.height + ROW_GAP;
  }, PADDING));

  const slotByKey = new Map(columns.flat().map(slot => [slot.key, slot]));
  const middleOf = (slot: GraphSlot) => slot.y + slot.height / 2;
  const edges: GraphEdge[] = routes.map(({ from, to, via }) => {
    const start = slotByKey.get(`${from}`)!;
    let end = { x: start.x + NODE_WIDTH, y: middleOf(start) };
    const segments = [`M${end.x},${end.y}`];
    [...via, slotByKey.get(`${to}`)!].forEach((slot) => {
      segments.push(curve(end, { x: slot.x, y: middleOf(slot) }));
      end = { x: slot.x + NODE_WIDTH, y: middleOf(slot) };
      if (slot.ticket === null) segments.push(`L${end.x},${end.y}`);
    });
    return { from, to, via, path: segments.join(' ') };
  });

  const width = PADDING * 2 + columns.length * NODE_WIDTH + Math.max(0, columns.length - 1) * GUTTER;
  const height = PADDING + Math.max(0, ...columns.map(column => column.at(-1)!.y + column.at(-1)!.height));

  return { columns, edges, width, height, nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT };
};

export const graphProgress = (rows: Pick<IssueRow, 'number' | 'status'>[]) => ({
  total: rows.length,
  ...countByStatus(rows),
  frontier: rows.filter(row => row.status === 'open').map(row => row.number),
});
