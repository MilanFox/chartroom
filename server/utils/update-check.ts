const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export interface Release {
  version: string
  url: string
}

let latestRelease: Release | null = null;
let failureLogged = false;

const releaseOf = (body: unknown): Release | null => {
  const { tag_name: tag, html_url: url } = (body ?? {}) as Record<string, unknown>;
  const parsed = typeof tag === 'string' ? parseVersion(tag) : null;
  if (!parsed || typeof url !== 'string') return null;
  return { version: parsed.version, url };
};

const fetchLatestRelease = async (releaseUrl: string) => {
  try {
    const response = await fetch(releaseUrl, {
      headers: { 'accept': 'application/vnd.github+json', 'user-agent': 'chartroom' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`the release endpoint answered ${response.status}`);
    const release = releaseOf(await response.json());
    if (!release) throw new Error('the release endpoint answered without a semver tag and release url');
    latestRelease = release;
  }
  catch (error) {
    if (failureLogged) return;
    failureLogged = true;
    process.stdout.write(`[debug] update check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }
};

export const startUpdateCheck = ({ updateCheck, releaseUrl }: DeploymentConfig) => {
  if (!updateCheck) return;
  fetchLatestRelease(releaseUrl);
  setInterval(() => fetchLatestRelease(releaseUrl), CHECK_INTERVAL_MS).unref();
};

export const availableUpdate = () =>
  latestRelease && isNewerVersion(latestRelease.version, useRuntimeConfig().version) ? latestRelease : null;
