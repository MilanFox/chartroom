import { describe, expect, it } from 'vitest';
import { versionMismatches } from './check-version.ts';

describe('versionMismatches', () => {
  it('finds nothing when the tag and every manifest agree', () => {
    expect(versionMismatches('v1.2.3', { 'package.json': '1.2.3', 'cli/package.json': '1.2.3' })).toEqual([]);
  });
});

describe('versionMismatches on disagreement', () => {
  it('names each manifest whose version differs from the tag', () => {
    expect(versionMismatches('v1.2.4', { 'package.json': '1.2.4', 'cli/package.json': '1.2.3' }))
      .toEqual(['cli/package.json has 1.2.3, tag v1.2.4 names 1.2.4']);
  });

  it('rejects a tag that is not vX.Y.Z', () => {
    expect(versionMismatches('v1.2.3-rc.1', { 'package.json': '1.2.3-rc.1' }))
      .toEqual(['tag v1.2.3-rc.1 is not vX.Y.Z']);
    expect(versionMismatches('1.2.3', { 'package.json': '1.2.3' }))
      .toEqual(['tag 1.2.3 is not vX.Y.Z']);
  });
});
