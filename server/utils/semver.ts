const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export const parseVersion = (text: string) => {
  const match = SEMVER.exec(text.trim());
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    version: `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ''}`,
    core: [Number(major), Number(minor), Number(patch)],
    prerelease: prerelease ?? null,
  };
};

const compareIdentifiers = (left: string, right: string) => {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
};

const comparePrereleases = (left: string, right: string) => {
  const leftIdentifiers = left.split('.');
  const rightIdentifiers = right.split('.');
  for (let index = 0; index < Math.min(leftIdentifiers.length, rightIdentifiers.length); index++) {
    const order = compareIdentifiers(leftIdentifiers[index]!, rightIdentifiers[index]!);
    if (order) return order;
  }
  return leftIdentifiers.length - rightIdentifiers.length;
};

export const isNewerVersion = (candidate: string, current: string) => {
  const next = parseVersion(candidate);
  const running = parseVersion(current);
  if (!next || !running) return false;
  for (let index = 0; index < 3; index++) {
    if (next.core[index] !== running.core[index]) return next.core[index]! > running.core[index]!;
  }
  if (!next.prerelease || !running.prerelease) return !next.prerelease && Boolean(running.prerelease);
  return comparePrereleases(next.prerelease, running.prerelease) > 0;
};
