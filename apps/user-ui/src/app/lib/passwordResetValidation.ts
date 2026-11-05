export const isValidResetEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const isValidResetOtp = (otp: string) => /^\d{6}$/.test(otp);

export const getNewPasswordError = (
  password: string,
  confirmation: string
) => {
  if (password.length < 8) {
    return 'Use a password with at least 8 characters.';
  }
  if (new TextEncoder().encode(password).length > 72) {
    return 'Use a password of 72 bytes or fewer.';
  }
  if (password !== confirmation) {
    return 'The passwords do not match.';
  }
  return '';
};
