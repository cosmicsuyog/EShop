import {
  getNewPasswordError,
  isValidResetEmail,
  isValidResetOtp,
} from './passwordResetValidation';

describe('password reset validation', () => {
  it('accepts a trimmed email address and rejects malformed addresses', () => {
    expect(isValidResetEmail(' customer@example.com ')).toBe(true);
    expect(isValidResetEmail('customer@localhost')).toBe(false);
  });

  it('accepts only six digit codes', () => {
    expect(isValidResetOtp('004219')).toBe(true);
    expect(isValidResetOtp('04219')).toBe(false);
    expect(isValidResetOtp('12345x')).toBe(false);
  });

  it('requires a matching password within backend hash limits', () => {
    expect(getNewPasswordError('short', 'short')).toContain('8 characters');
    expect(getNewPasswordError('long-enough', 'different')).toContain(
      'do not match'
    );
    expect(getNewPasswordError('a'.repeat(73), 'a'.repeat(73))).toContain(
      '72 bytes'
    );
    expect(getNewPasswordError('valid pass', 'valid pass')).toBe('');
  });
});
