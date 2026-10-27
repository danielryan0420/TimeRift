import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, isValidName, sanitizeName } from '../src/core/names';

describe('sanitizeName', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeName('  Max  ')).toBe('Max');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(sanitizeName('   ')).toBe('');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeName('')).toBe('');
  });

  it('caps length at MAX_NAME_LENGTH', () => {
    const long = 'a'.repeat(MAX_NAME_LENGTH + 10);
    expect(sanitizeName(long)).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('isValidName', () => {
  it('accepts a normal name', () => {
    expect(isValidName('Max')).toBe(true);
  });

  it('rejects empty and whitespace-only names', () => {
    expect(isValidName('')).toBe(false);
    expect(isValidName('   ')).toBe(false);
    expect(isValidName('\t\n')).toBe(false);
  });
});
