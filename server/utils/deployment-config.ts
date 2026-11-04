const PREFIX = 'CHARTROOM_';
const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/milanfox/chartroom/releases/latest';

export interface DeploymentConfig {
  adminPassword: string
  viewerPassword: string
  baseUrl: string | null
  trustProxy: boolean
  port: number
  updateCheck: boolean
  releaseUrl: string
  dataDir: string
  elevationSeconds: number
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
    releaseUrl: optional('RELEASE_URL') ?? GITHUB_LATEST_RELEASE_URL,
    dataDir: optional('DATA_DIR') ?? '/data',
    elevationSeconds: Number(optional('ELEVATION_SECONDS') ?? 3600),
  };
};

let current: DeploymentConfig | undefined;

export const useDeploymentConfig = () => {
  current ??= readDeploymentConfig();
  return current;
};
