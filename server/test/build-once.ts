import { spawnSync } from 'node:child_process';

export default () => {
  const result = spawnSync('npx', ['nuxt', 'build'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
  if (result.status !== 0) throw new Error(`nuxt build failed with exit code ${result.status}`);
  const cliBuild = spawnSync('npx', ['tsc', '-p', 'cli'], { stdio: 'inherit' });
  if (cliBuild.status !== 0) throw new Error(`cli build failed with exit code ${cliBuild.status}`);
};
