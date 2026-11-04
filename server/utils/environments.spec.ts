import { describe, expect, it } from 'vitest';
import { refuseSecretLooking } from './environments';

describe('refuseSecretLooking', () => {
  it.each([
    'ghp_abcdef',
    'glpat-xxxx',
    'sk-live-123',
    'AKIAIOSFODNN7EXAMPLE',
    '-----BEGIN PRIVATE KEY-----',
    'password: hunter2',
    'Password :hunter2',
    'pw=hunter2',
    'token = abc',
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  ])('refuses %s', (value) => {
    expect(() => refuseSecretLooking(value, 'notes')).toThrowError(expect.objectContaining({ code: 'invalid', field: 'notes' }));
  });

  it.each([
    'In the team vault under Staging',
    'service account for CI',
    'password reset lives in 1Password',
    'the token is stored in Vault',
    'abcdefghijklmnopqrstuvwxyzabcdefgh',
    '12345678901234567890123456789012',
  ])('passes %s through unchanged', (value) => {
    expect(refuseSecretLooking(value, 'notes')).toBe(value);
  });
});
