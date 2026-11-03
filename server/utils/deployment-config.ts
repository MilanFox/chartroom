const PREFIX = 'CHARTROOM_';

export interface DeploymentConfig {
  adminPassword: string
  viewerPassword: string
  baseUrl: string | null
  trustProxy: boolean
  port: number
  updateCheck: boolean
  dataDir: string
}

export class MissingVariableError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable ${variable}`);
  }
}

export const readDeploymentConfig = (env: NodeJS.ProcessEnv = process.env): DeploymentConfig => {
  const optional = (name: string) => env[`${PREFIX}${name}`] || null;
  const required = (name: string) => {
    const value = optional(name);
    if (!value) throw new MissingVariableError(`${PREFIX}${name}`);
    return value;
  };
  return {
    adminPassword: required('ADMIN_PASSWORD'),
    viewerPassword: required('VIEWER_PASSWORD'),
    baseUrl: optional('BASE_URL'),
    trustProxy: optional('TRUST_PROXY') === 'true',
    port: Number(optional('PORT') ?? 3000),
    updateCheck: optional('UPDATE_CHECK') !== 'false',
    dataDir: optional('DATA_DIR') ?? '/data',
  };
};

let current: DeploymentConfig | undefined;

export const useDeploymentConfig = () => {
  current ??= readDeploymentConfig();
  return current;
};
