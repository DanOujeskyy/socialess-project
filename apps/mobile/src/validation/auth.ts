export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(email.trim())) return 'Enter a valid email address (e.g. name@example.com)';
  return null;
}

export function validateUsername(username: string): string | null {
  const v = username.trim();
  if (!v) return 'Username is required';
  if (v.length < 3) return 'Username must be at least 3 characters';
  if (v.length > 20) return 'Username must be at most 20 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Only letters, numbers, and underscores are allowed';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/\d/.test(password)) return 'Password must contain at least one number';
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}

export function validateLoginPassword(password: string): string | null {
  if (!password) return 'Password is required';
  return null;
}

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 0;
  if (password.length < 8) return 1;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const isLong = password.length >= 12;
  if (isLong && hasNumber && hasSpecial) return 4;
  if (hasNumber && hasSpecial) return 3;
  if (hasNumber || hasSpecial) return 2;
  return 1;
}

export const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
};
