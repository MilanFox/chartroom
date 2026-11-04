import { describe, expect, it } from 'vitest';
import { slugFrom } from './slug';

const holderSlug = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const effortSlug = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('slugFrom', () => {
  it('folds accents, lowercases and joins words with single dashes', () => {
    expect(slugFrom('Jürgen Müller')).toBe('jurgen-muller');
    expect(slugFrom('  Agent tracker!! v2 ')).toBe('agent-tracker-v2');
  });

  it('gives an empty slug when nothing sluggable is left', () => {
    expect(slugFrom('日本')).toBe('');
    expect(slugFrom(' -- ')).toBe('');
  });

  it('caps at 64 characters without ending on a dash', () => {
    const capped = slugFrom(`${'a'.repeat(63)} b`);
    expect(capped).toBe('a'.repeat(63));
    expect(slugFrom('x'.repeat(100))).toHaveLength(64);
  });

  it('only produces slugs both holders and Efforts accept', () => {
    for (const text of ['Jürgen Müller', 'Ångström — Øre', `${'ab '.repeat(40)}`, 'v2.0_final', 'Ça va?']) {
      const slug = slugFrom(text);
      expect(slug).toMatch(holderSlug);
      expect(slug).toMatch(effortSlug);
    }
  });
});
