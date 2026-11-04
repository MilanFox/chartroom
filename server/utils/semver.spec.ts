import { describe, expect, it } from 'vitest';
import { isNewerVersion } from './semver';

describe('isNewerVersion', () => {
  it.each([
    ['0.2.0', '0.1.0'],
    ['v1.0.0', '0.9.9'],
    ['0.1.10', '0.1.9'],
    ['1.0.0', '1.0.0-rc.1'],
    ['1.0.0-rc.2', '1.0.0-rc.1'],
    ['1.0.0-rc.10', '1.0.0-rc.9'],
    ['1.0.0-beta', '1.0.0-1'],
    ['1.0.0-rc.1.1', '1.0.0-rc.1'],
  ])('%s is newer than %s', (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(true);
  });

  it.each([
    ['0.1.0', '0.1.0'],
    ['v0.1.0', '0.1.0'],
    ['0.1.0+build.7', '0.1.0'],
    ['0.0.9', '0.1.0'],
    ['0.9.0', '1.0.0'],
    ['1.0.0-rc.1', '1.0.0'],
    ['not-a-version', '0.1.0'],
    ['0.2', '0.1.0'],
  ])('%s is not newer than %s', (candidate, current) => {
    expect(isNewerVersion(candidate, current)).toBe(false);
  });
});
