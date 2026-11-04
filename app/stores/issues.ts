import { defineStore } from 'pinia';
import type { IssueComment, IssueDocument, IssueKind, IssueLink, IssueRow, LinkRole, LinkType, Page } from '~/types/api';
import type { ParentCandidate } from '~/utils/issue-fields';

export interface IssueFieldEdit {
  title?: string
  body?: string
  parent?: number | null
  name?: string | null
  testInstructions?: string | null
}

export interface LinkDraft {
  role: LinkRole
  type: LinkType
  url: string
  title: string
}

const PAGE_LIMIT = 200;
const PARENT_KINDS: IssueKind[] = ['effort', 'map', 'spec'];

export const useIssuesStore = defineStore('issues', () => {
  const uiFetch = useUiFetch();
  const documents = ref<Record<number, IssueDocument>>({});
  const parentCandidates = ref<ParentCandidate[]>([]);

  const keep = (document: IssueDocument) => {
    documents.value[document.number] = document;
    return document;
  };

  const load = async (number: number) => keep(await uiFetch<IssueDocument>(`/issues/${number}`));

  const writeThenReload = async (number: number, path: string, request: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: Record<string, unknown> }) => {
    await uiFetch(`/issues/${number}${path}`, request);
    return load(number);
  };

  const edit = async (number: number, fields: IssueFieldEdit, version: number) =>
    keep(await uiFetch<IssueDocument>(`/issues/${number}`, { method: 'PATCH', body: { ...fields }, headers: { 'If-Match': `"${version}"` } }));

  const act = async (number: number, action: 'claim' | 'reopen') => keep(await uiFetch<IssueDocument>(`/issues/${number}/${action}`, { method: 'POST' }));

  const claim = (number: number) => act(number, 'claim');

  const reopen = (number: number) => act(number, 'reopen');

  const unassign = async (number: number) => keep(await uiFetch<IssueDocument>(`/issues/${number}/assignee`, { method: 'DELETE' }));

  const close = async (number: number, comment: string) => {
    const body = comment.trim() ? { comment } : {};
    return keep(await uiFetch<IssueDocument>(`/issues/${number}/close`, { method: 'POST', body }));
  };

  const addLabel = (number: number, label: string) => writeThenReload(number, `/labels/${encodeURIComponent(label)}`, { method: 'PUT' });

  const removeLabel = (number: number, label: string) => writeThenReload(number, `/labels/${encodeURIComponent(label)}`, { method: 'DELETE' });

  const addBlocker = (number: number, blocker: number) => writeThenReload(number, `/blockers/${blocker}`, { method: 'PUT' });

  const removeBlocker = (number: number, blocker: number) => writeThenReload(number, `/blockers/${blocker}`, { method: 'DELETE' });

  const addComment = (number: number, body: string) => writeThenReload(number, '/comments', { method: 'POST', body: { body } });

  const editComment = (number: number, comment: IssueComment['id'], body: string) => writeThenReload(number, `/comments/${comment}`, { method: 'PATCH', body: { body } });

  const deleteComment = (number: number, comment: IssueComment['id']) => writeThenReload(number, `/comments/${comment}`, { method: 'DELETE' });

  const addLink = (number: number, draft: LinkDraft) => writeThenReload(number, '/links', { method: 'POST', body: { ...draft } });

  const editLink = (number: number, link: IssueLink['id'], fields: Omit<LinkDraft, 'url'>) => writeThenReload(number, `/links/${link}`, { method: 'PATCH', body: { ...fields } });

  const removeLink = (number: number, link: IssueLink['id']) => writeThenReload(number, `/links/${link}`, { method: 'DELETE' });

  const rowsOfKind = async (kind: IssueKind) => {
    const rows: IssueRow[] = [];
    let cursor: string | null = null;
    do {
      const page: Page<IssueRow> = await uiFetch<Page<IssueRow>>('/issues', { query: { kind, limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) } });
      rows.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return rows;
  };

  const loadParentCandidates = async () => {
    const rows = await Promise.all(PARENT_KINDS.map(rowsOfKind));
    parentCandidates.value = rows.flat().map(({ number, kind, title }) => ({ number, kind, title }));
  };

  return {
    documents,
    parentCandidates,
    load,
    edit,
    claim,
    unassign,
    close,
    reopen,
    addLabel,
    removeLabel,
    addBlocker,
    removeBlocker,
    addComment,
    editComment,
    deleteComment,
    addLink,
    editLink,
    removeLink,
    loadParentCandidates,
  };
});
