import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

export default () => {
  const result = spawnSync('npx', ['nuxt', 'build'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
  if (result.status !== 0) throw new Error(`nuxt build failed with exit code ${result.status}`);
  rmSync('cli/dist', { recursive: true, force: true });
  const cliBuild = spawnSync('npx', ['tsc', '-p', 'cli'], { stdio: 'inherit' });
  if (cliBuild.status !== 0) throw new Error(`cli build failed with exit code ${cliBuild.status}`);
};
