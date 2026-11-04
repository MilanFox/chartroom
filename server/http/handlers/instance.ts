import type { H3Event } from 'h3';
import type { AdapterFile } from '../../utils/adapter';

export const instanceRead = () => ({
  ...instanceSettingsOf(),
  version: useRuntimeConfig().version,
  updateAvailable: null,
  openIssues: openIssueCount(),
});

export const adapterFile = (file: AdapterFile) => (event: H3Event) => {
  setResponseHeader(event, 'content-type', 'text/markdown; charset=utf-8');
  return renderAdapterFile(file, baseUrl(event));
};

export const SETTINGS_PROPERTIES = {
  projectName: { type: 'string' },
  effortName: { type: 'object', properties: { singular: { type: 'string' }, plural: { type: 'string' } }, required: ['singular', 'plural'] },
  triageLabels: { type: 'object', description: 'Display label per triage-state member id', additionalProperties: { type: 'string' } },
};

const INSTANCE_PROPERTIES = {
  ...SETTINGS_PROPERTIES,
  version: { type: 'string' },
  updateAvailable: { type: ['string', 'null'] },
  openIssues: { type: 'integer', description: 'Open issues of every Kind on the Instance' },
};

export const INSTANCE_SCHEMA = { type: 'object', properties: INSTANCE_PROPERTIES, required: Object.keys(INSTANCE_PROPERTIES) };
