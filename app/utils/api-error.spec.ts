import { describe, expect, it } from 'vitest';
import { fieldErrorOf, slugErrorOf } from './api-error';

const failureOf = (code: string, field?: string, message = 'nope') => ({ data: { error: { code, field, message } } });

describe('fieldErrorOf', () => {
  it('names the failing field and its message when the field is one the form shows', () => {
    expect(fieldErrorOf(failureOf('invalid', 'url', 'Not a URL'), ['name', 'url'])).toEqual({ field: 'url', message: 'Not a URL' });
  });

  it('is null for a field the form does not show, or no field at all', () => {
    expect(fieldErrorOf(failureOf('invalid', 'other'), ['name', 'url'])).toBeNull();
    expect(fieldErrorOf(failureOf('forbidden'), ['name'])).toBeNull();
    expect(fieldErrorOf(new Error('offline'), ['name'])).toBeNull();
  });
});

describe('slugErrorOf', () => {
  const messages = { taken: 'Taken', shape: 'Bad shape' };

  it('says taken for a conflict and shape for anything else', () => {
    expect(slugErrorOf(failureOf('conflict', 'slug'), messages)).toBe('Taken');
    expect(slugErrorOf(failureOf('invalid', 'slug'), messages)).toBe('Bad shape');
  });
});
