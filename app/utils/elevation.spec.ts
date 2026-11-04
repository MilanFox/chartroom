import { describe, expect, it } from 'vitest';
import { clockTime, elevationEnd } from './elevation';

const holder = { slug: 'milan', displayName: null, viewer: false };

describe('elevationEnd', () => {
  it('is the admin until time while it lies ahead', () => {
    const until = '2026-11-04T17:56:00.000Z';

    expect(elevationEnd({ ...holder, admin: { until } }, new Date('2026-11-04T17:00:00.000Z'))).toEqual(new Date(until));
  });

  it('is null once the time has passed, so the chip goes without a reload', () => {
    const admin = { until: '2026-11-04T17:56:00.000Z' };

    expect(elevationEnd({ ...holder, admin }, new Date('2026-11-04T17:56:00.000Z'))).toBeNull();
  });

  it('is null for a session that never elevated or has signed out', () => {
    expect(elevationEnd({ ...holder, admin: null }, new Date())).toBeNull();
    expect(elevationEnd(null, new Date())).toBeNull();
  });
});

describe('clockTime', () => {
  it('reads HH:MM in local time on a 24-hour clock', () => {
    expect(clockTime(new Date(2026, 10, 4, 7, 5))).toBe('07:05');
    expect(clockTime(new Date(2026, 10, 4, 17, 56))).toBe('17:56');
  });
});
