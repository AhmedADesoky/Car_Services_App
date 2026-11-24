/**
 * Password policy shared by station accounts and company (platform) accounts (spec AUTH-03).
 * Returns a list of problem codes; empty = accepted.
 */
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'admin', 'admin123', 'welcome', 'welcome1', 'letmein', 'iloveyou', 'abc123',
  '11111111', '00000000', 'p@ssw0rd', 'passw0rd', 'changeme', 'test1234', 'egypt123', 'cairo123',
]);

export type Password_Problem = 'TOO_SHORT' | 'TOO_LONG' | 'TOO_COMMON' | 'CONTAINS_USERNAME' | 'NEEDS_VARIETY';

export function checkPassword(password: string, opts: { minLength: number; username?: string }): Password_Problem[] {
  const problems: Password_Problem[] = [];
  if (password.length < opts.minLength) problems.push('TOO_SHORT');
  if (password.length > 128) problems.push('TOO_LONG');
  if (COMMON.has(password.toLowerCase())) problems.push('TOO_COMMON');
  const user = opts.username?.toLowerCase().split('@')[0];
  if (user && user.length >= 3 && password.toLowerCase().includes(user)) problems.push('CONTAINS_USERNAME');
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (kinds < 3) problems.push('NEEDS_VARIETY');
  return problems;
}
