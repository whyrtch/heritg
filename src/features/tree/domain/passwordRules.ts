export type PasswordChecks = { length8: boolean; lower: boolean; upper: boolean; digit: boolean; symbol: boolean; ok: boolean };

/** Rules for a protecting password (backup file and web link): 8+ characters with lower, upper, digit and symbol. */
export function checkPassword(password: string): PasswordChecks {
  const length8 = password.length >= 8;
  const lower = /\p{Ll}/u.test(password);
  const upper = /\p{Lu}/u.test(password);
  const digit = /\d/.test(password);
  const symbol = /[^\p{L}\p{N}\s]/u.test(password);
  return { length8, lower, upper, digit, symbol, ok: length8 && lower && upper && digit && symbol };
}
