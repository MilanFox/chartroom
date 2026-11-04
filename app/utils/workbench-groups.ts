import type { IssueRow } from '~/types/api';

export interface EffortGroup {
  effort: number | null
  rows: IssueRow[]
  lastUpdated: string
}

const effortOf = (row: IssueRow) => (row.kind === 'effort' ? row.number : row.effort);

export const groupByEffort = (rows: IssueRow[]): EffortGroup[] => {
  const rowsByEffort = new Map<number | null, IssueRow[]>();
  for (const row of rows) rowsByEffort.set(effortOf(row), [...(rowsByEffort.get(effortOf(row)) ?? []), row]);
  return [...rowsByEffort]
    .map(([effort, groupRows]) => ({ effort, rows: groupRows, lastUpdated: groupRows.reduce((latest, { updatedAt }) => (updatedAt > latest ? updatedAt : latest), '') }))
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
};
