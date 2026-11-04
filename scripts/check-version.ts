import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MANIFESTS = ['package.json', 'cli/package.json'];

export const versionMismatches = (tag: string, manifestVersions: Record<string, string>) => {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) return [`tag ${tag} is not vX.Y.Z`];
  const tagVersion = tag.slice(1);
  return Object.entries(manifestVersions)
    .filter(([, version]) => version !== tagVersion)
    .map(([path, version]) => `${path} has ${version}, tag ${tag} names ${tagVersion}`);
};

const readManifestVersions = (repoRoot: string) => Object.fromEntries(MANIFESTS.map((path) => {
  const { version } = JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as { version: string };
  return [path, version];
}));

if (import.meta.main) {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';
  const mismatches = versionMismatches(tag, readManifestVersions(resolve(import.meta.dirname, '..')));
  for (const mismatch of mismatches) process.stderr.write(`${mismatch}\n`);
  if (mismatches.length) process.exit(1);
  process.stdout.write(`${tag} matches ${MANIFESTS.join(', ')}\n`);
}
