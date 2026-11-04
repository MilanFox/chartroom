import type { InstanceNames } from '~/types/api';

export interface StringNames {
  project: string
  effort: string
  efforts: string
}

type StringTree = { [key: string]: string | StringTree };

const fillNames = <T extends StringTree>(tree: T, names: StringNames): T =>
  Object.fromEntries(Object.entries(tree).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.replace(/\{(project|effort|efforts)\}/g, (_, name: keyof StringNames) => names[name]) : fillNames(value, names),
  ])) as T;

export const resolveStrings = <T extends StringTree & { names: StringNames }>(catalog: T, instance: InstanceNames | null): T => {
  const names = instance
    ? { project: instance.projectName, effort: instance.effortName.singular, efforts: instance.effortName.plural }
    : catalog.names;
  return fillNames({ ...catalog, names }, names);
};

export const formatString = (template: string, params: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (placeholder, name: string) => (name in params ? String(params[name]) : placeholder));
