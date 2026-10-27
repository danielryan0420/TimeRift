export const MAX_NAME_LENGTH = 24;

/** Trims surrounding whitespace and caps length; does not fill in a fallback. */
export function sanitizeName(raw: string): string {
  return raw.trim().slice(0, MAX_NAME_LENGTH);
}

export function isValidName(raw: string): boolean {
  return sanitizeName(raw).length > 0;
}
