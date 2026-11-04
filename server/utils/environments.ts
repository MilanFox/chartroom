import { asc, eq } from 'drizzle-orm';
import { credentialPointers, environments } from '../db/schema';

export type EnvironmentRecord = typeof environments.$inferSelect;
export type PointerRecord = typeof credentialPointers.$inferSelect;

export interface EnvironmentFields {
  name?: string
  url?: string
  notes?: string | null
}

export interface PointerFields {
  label?: string
  accountName?: string
  whereToFind?: string
  environment?: number | null
}

const SECRET_LOOKING = [
  /(?<![A-Za-z0-9])(?:chr_|ghp_|glpat-|sk-|xox|AKIA)/,
  /-----BEGIN/,
  /(?<![A-Za-z0-9])(?:password\s*:|pw\s*=|token\s*=)\s*\S/i,
  /(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{32,}/,
];

export const refuseSecretLooking = (value: string, field: string) => {
  if (SECRET_LOOKING.some(pattern => pattern.test(value))) throw invalid(`${field} looks like a secret; store where to find it, never the secret itself`, field);
  return value;
};

export const listEnvironments = (): EnvironmentRecord[] => useStore().select().from(environments).orderBy(asc(environments.id)).all();

export const listPointers = (): PointerRecord[] => useStore().select().from(credentialPointers).orderBy(asc(credentialPointers.id)).all();

const requireEnvironment = (id: number) => {
  const environment = useStore().select().from(environments).where(eq(environments.id, id)).get();
  if (!environment) throw notFound(`environment ${id} does not exist`);
  return environment;
};

const requirePointer = (id: number) => {
  const pointer = useStore().select().from(credentialPointers).where(eq(credentialPointers.id, id)).get();
  if (!pointer) throw notFound(`credential pointer ${id} does not exist`);
  return pointer;
};

export const createEnvironment = (fields: Required<EnvironmentFields>, actor: string) =>
  useStore().insert(environments).values({ ...fields, ...stamp(actor) }).returning().get();

export const updateEnvironment = (id: number, fields: EnvironmentFields, actor: string) => {
  requireEnvironment(id);
  return useStore().update(environments).set({ ...fields, ...stamp(actor) }).where(eq(environments.id, id)).returning().get()!;
};

export const deleteEnvironment = (id: number) => {
  requireEnvironment(id);
  useStore().delete(environments).where(eq(environments.id, id)).run();
};

export const createPointer = (fields: Required<PointerFields>, actor: string) => {
  if (typeof fields.environment === 'number') requireEnvironment(fields.environment);
  return useStore().insert(credentialPointers).values({ ...fields, ...stamp(actor) }).returning().get();
};

export const updatePointer = (id: number, fields: PointerFields, actor: string) => {
  requirePointer(id);
  if (typeof fields.environment === 'number') requireEnvironment(fields.environment);
  return useStore().update(credentialPointers).set({ ...fields, ...stamp(actor) }).where(eq(credentialPointers.id, id)).returning().get()!;
};

export const deletePointer = (id: number) => {
  requirePointer(id);
  useStore().delete(credentialPointers).where(eq(credentialPointers.id, id)).run();
};
