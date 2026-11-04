export const ADAPTER_FILES = ['issue-tracker.md', 'triage-labels.md'] as const;

export type AdapterFile = typeof ADAPTER_FILES[number];

const labelGroupRows = () => listLabelGroups()
  .map(group => `| \`${group.id}\` | ${group.labels.map(label => `\`${label.id}\``).join(', ')} | yes |`)
  .join('\n');

export const renderAdapterFile = async (file: AdapterFile, baseUrl: string) => {
  const template = await useStorage('assets:adapter').getItem<string>(file);
  if (typeof template !== 'string') throw new Error(`adapter template ${file} is missing from the build`);
  const { version } = useRuntimeConfig();
  const settings = instanceSettingsOf();
  const values: Record<string, string> = {
    baseUrl,
    version,
    date: nowIso().slice(0, 10),
    major: version.split('.')[0]!,
    Effort: settings.effortName.singular,
    Efforts: settings.effortName.plural,
    labelGroups: labelGroupRows(),
    ...Object.fromEntries(Object.entries(settings.triageLabels).map(([id, label]) => [`triage:${id}`, label])),
  };
  return template.replace(/\{\{([^}]+)\}\}/g, (placeholder, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Adapter template has an unknown placeholder ${placeholder}`);
    return value;
  });
};
