export interface EffortRef {
  number: number
  name: string | null
  title: string
}

export const effortPath = (effort: Pick<EffortRef, 'number'>) => `/efforts/${effort.number}`;

export const issuePath = (number: number) => `/issues/${number}`;

export const ADMIN_SECTION_IDS = ['settings', 'environments', 'holders', 'labels', 'efforts', 'snapshots', 'about'] as const;

export type AdminSectionId = typeof ADMIN_SECTION_IDS[number];

export const adminSectionPath = (section: AdminSectionId | 'elevate') => `/admin#${section}`;

export const LOGIN_PATH = '/login';

export const HOME_PATH = '/';

export const ISSUES_PATH = '/issues';

export const API_DOCS_PATH = '/api/docs';
