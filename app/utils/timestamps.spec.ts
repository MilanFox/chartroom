import { describe, expect, it } from 'vitest';
import { formatDate, formatTimestamp } from './timestamps';

describe('timestamps', () => {
  it('shows a timestamp as local date and minute', () => {
    const local = new Date(2026, 10, 4, 9, 5).toISOString();

    expect(formatTimestamp(local)).toBe('2026-11-04 09:05');
    expect(formatDate(local)).toBe('2026-11-04');
  });
});
