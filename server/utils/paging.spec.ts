import { beforeAll, describe, expect, it, vi } from 'vitest';
import { invalid } from './errors';
import { encodeCursor, idCursor, sortCursor, tupleCursor } from './paging';

beforeAll(() => {
  vi.stubGlobal('invalid', invalid);
});

const withCursor = (...key: unknown[]) => ({ cursor: encodeCursor(key) });
const isString = (value: unknown) => typeof value === 'string';
const isNumber = (value: unknown) => typeof value === 'number';

const refusal = expect.objectContaining({ field: 'cursor', message: 'cursor is not valid' });

describe('idCursor', () => {
  it('is null without a cursor and the id with one', () => {
    expect(idCursor({})).toBeNull();
    expect(idCursor(withCursor(7))).toBe(7);
  });

  it('refuses a cursor that is not base64url JSON, not an array, or has a non-numeric id', () => {
    expect(() => idCursor({ cursor: '!!!' })).toThrow(refusal);
    expect(() => idCursor({ cursor: Buffer.from('{"a":1}').toString('base64url') })).toThrow(refusal);
    expect(() => idCursor(withCursor('7'))).toThrow(refusal);
  });
});

describe('sortCursor', () => {
  it('returns the sort key and number when the sort and key shape match', () => {
    expect(sortCursor({}, 'title', isString)).toBeNull();
    expect(sortCursor(withCursor('title', 'abc', 4), 'title', isString)).toEqual({ key: 'abc', number: 4 });
  });

  it('refuses a cursor from another sort, a key of the wrong shape or a non-numeric number', () => {
    expect(() => sortCursor(withCursor('number', 'abc', 4), 'title', isString)).toThrow(refusal);
    expect(() => sortCursor(withCursor('title', 5, 4), 'title', isString)).toThrow(refusal);
    expect(() => sortCursor(withCursor('title', 'abc', '4'), 'title', isString)).toThrow(refusal);
  });
});

describe('tupleCursor', () => {
  it('returns the key when every guard accepts its position', () => {
    expect(tupleCursor({}, [isString, isNumber])).toBeNull();
    expect(tupleCursor(withCursor('2026-01-01', 3), [isString, isNumber])).toEqual(['2026-01-01', 3]);
  });

  it('refuses a key where a guard rejects or a position is missing', () => {
    expect(() => tupleCursor(withCursor(1, 3), [isString, isNumber])).toThrow(refusal);
    expect(() => tupleCursor(withCursor('a'), [isString, isNumber])).toThrow(refusal);
  });
});
