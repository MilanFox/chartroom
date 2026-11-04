import { describe, expect, it } from 'vitest';
import { labelDomId } from './label-keys';

describe('labelDomId', () => {
  it('keeps hyphenated group and member ids apart', () => {
    expect(labelDomId('member', 'a-b', 'c')).not.toBe(labelDomId('member', 'a', 'b-c'));
    expect(labelDomId('add-label', 'x')).not.toBe(labelDomId('add', 'label-x'));
  });
});
