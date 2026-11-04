import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll } from 'vitest';

const SERVER_ENTRY = resolve(import.meta.dirname, '../../.output/server/index.mjs');
const BOOT_TIMEOUT_MS = 10_000;
const UNREACHABLE_RELEASE_URL = 'http://127.0.0.1:9/releases/latest';

export const TEST_PASSWORDS = {
  CHARTROOM_ADMIN_PASSWORD: 'admin-secret',
  CHARTROOM_VIEWER_PASSWORD: 'viewer-secret',
};

export interface ExitResult {
  code: number | null
  stderr: string
  stdout: string
}

export interface LaunchedServer {
  baseUrl: string
  dataDir: string
  port: number
  fetch: typeof fetch
  exited: Promise<{ code: number | null, stderr: string, stdout: string }>
  kill: () => Promise<void>
  stop: () => Promise<void>
}

export const freePort = () => new Promise<number>((resolvePort, reject) => {
  const probe = createServer();
  probe.unref();
  probe.on('error', reject);
  probe.listen(0, () => {
    const { port } = probe.address() as { port: number };
    probe.close(() => resolvePort(port));
  });
});

const withoutChartroomVariables = (env: NodeJS.ProcessEnv) =>
  Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('CHARTROOM_')));

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

export const launchServer = async (options: { env?: Record<string, string>, dataDir?: string } = {}): Promise<LaunchedServer> => {
  const dataDir = options.dataDir ?? mkdtempSync(join(tmpdir(), 'chartroom-'));
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...withoutChartroomVariables(process.env),
      NODE_ENV: 'production',
      CHARTROOM_DATA_DIR: dataDir,
      CHARTROOM_PORT: String(port),
      CHARTROOM_RELEASE_URL: UNREACHABLE_RELEASE_URL,
      ...TEST_PASSWORDS,
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const exited = new Promise<{ code: number | null, stderr: string, stdout: string }>((resolveExit) => {
    child.on('exit', code => resolveExit({ code, stderr, stdout }));
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const boundFetch: typeof fetch = (input, init) => fetch(new URL(String(input), baseUrl), init);
  const kill = async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
  };
  const stop = async () => {
    await kill();
    rmSync(dataDir, { recursive: true, force: true });
  };
  return { baseUrl, dataDir, port, fetch: boundFetch, exited, kill, stop };
};

export const waitUntilHealthy = async (server: LaunchedServer) => {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let settled = false;
  server.exited.then(() => {
    settled = true;
  });
  while (Date.now() < deadline) {
    if (settled) {
      const { code, stderr } = await server.exited;
      throw new Error(`server exited with code ${code} before becoming healthy\n${stderr}`);
    }
    const healthy = await server.fetch('/health').then(response => response.ok).catch(() => false);
    if (healthy) return server;
    await sleep(50);
  }
  throw new Error(`server on port ${server.port} not healthy within ${BOOT_TIMEOUT_MS}ms`);
};

export const bootServer = async (options?: Parameters<typeof launchServer>[0]) => waitUntilHealthy(await launchServer(options));

export const useTestServer = () => {
  const handle = {} as LaunchedServer;
  beforeAll(async () => {
    Object.assign(handle, await launchServer());
    await waitUntilHealthy(handle);
  });
  afterAll(() => handle.stop?.());
  return handle;
};
