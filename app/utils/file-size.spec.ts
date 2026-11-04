import { describe, expect, it } from 'vitest';
import { formatFileSize } from './file-size';

describe('formatFileSize', () => {
  it('shows bytes, kilobytes and megabytes in the unit that keeps the number short', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(40_960)).toBe('40 KB');
    expect(formatFileSize(1_572_864)).toBe('1.5 MB');
    expect(formatFileSize(52_428_800)).toBe('50 MB');
  });
});
