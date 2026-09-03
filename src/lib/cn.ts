type ClassValue = string | number | null | undefined | false | ClassValue[];

/**
 * Join class names, dropping falsy values.
 *
 * Deliberately not `tailwind-merge`: that library resolves conflicts by parsing
 * web Tailwind class names, and NativeWind's generated class set does not match
 * its assumptions. Keep conditionals explicit instead of relying on
 * last-one-wins merging.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(' ');
}
