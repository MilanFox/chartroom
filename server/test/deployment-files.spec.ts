import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoFileText = (name: string) => readFileSync(resolve(import.meta.dirname, '../..', name), 'utf8');

const OPERATOR_VARIABLES = [
  'CHARTROOM_ADMIN_PASSWORD',
  'CHARTROOM_VIEWER_PASSWORD',
  'CHARTROOM_BASE_URL',
  'CHARTROOM_TRUST_PROXY',
  'CHARTROOM_PORT',
  'CHARTROOM_UPDATE_CHECK',
];
const DEVELOPMENT_VARIABLES = ['CHARTROOM_DATA_DIR', 'CHARTROOM_ELEVATION_SECONDS', 'CHARTROOM_RELEASE_URL'];

describe('compose example', () => {
  const compose = repoFileText('compose.example.yaml');

  it('pins the image to a version tag, never latest', () => {
    expect(compose).toMatch(/^\s*image:\s*ghcr\.io\/milanfox\/chartroom:\d+\.\d+\.\d+\s*$/m);
    expect(compose).not.toMatch(/chartroom:latest/);
  });

  it.each(DEVELOPMENT_VARIABLES)('carries no development-only %s', (variable) => {
    expect(compose).not.toContain(variable);
  });
});

describe('.env.example', () => {
  const envExample = repoFileText('.env.example');
  const variablesReadByConfig = [...repoFileText('server/utils/deployment-config.ts').matchAll(/(?:optional|required)\('([A-Z_]+)'\)/g)]
    .map(([, name]) => `CHARTROOM_${name}`);

  it('the expected lists cover every variable the deployment config reads', () => {
    expect([...OPERATOR_VARIABLES, ...DEVELOPMENT_VARIABLES].sort()).toEqual([...variablesReadByConfig].sort());
  });

  it.each(OPERATOR_VARIABLES)('documents %s', (variable) => {
    expect(envExample).toMatch(new RegExp(`^#?\\s*${variable}=`, 'm'));
  });

  it.each(DEVELOPMENT_VARIABLES)('leaves out the development-only %s', (variable) => {
    expect(envExample).not.toContain(variable);
  });
});
