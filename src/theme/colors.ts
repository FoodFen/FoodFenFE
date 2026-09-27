/**
 * The palette as JavaScript values.
 *
 * `global.css` is the source of truth for anything styled with `className`.
 * This file mirrors it for the places that cannot take a class name: SVG
 * `fill`/`stroke`, React Navigation's theme, the status bar, and Reanimated
 * interpolations.
 *
 * Keep the two in step — a value changed in one must be changed in the other.
 */

export const palette = {
  light: {
    // Darkened from green-600/amber-600 (2026-09-21 contrast audit): the
    // original values only cleared ~3.0-3.3:1 against `bg`/white text, below
    // WCAG AA's 4.5:1 for normal text. These -700 shades verify at 4.8-5.0:1
    // both as text-on-bg and as white-text-on-fill. Dark mode was untouched —
    // it already passed (8.5-12:1).
    brand: '#15803D',
    brandSoft: '#DCFCE7',
    onBrand: '#FFFFFF',

    bg: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceAlt: '#F3F4F6',
    border: '#E5E7EB',

    fg: '#111827',
    fgMuted: '#6B7280',
    // Between gray-400 and gray-500: gray-400 measured 2.4:1 (fails even the
    // 3:1 non-text/icon minimum). This clears 3:1 with margin while staying
    // visibly lighter than fgMuted (4.6:1) — but still isn't 4.5:1, so it
    // should not carry primary readable caption text, only icons/decorative/
    // disabled use.
    fgSubtle: '#7E8896',

    protein: '#EF4444',
    carbs: '#F59E0B',
    fat: '#3B82F6',

    success: '#15803D',
    warning: '#B45309',
    danger: '#DC2626',
  },
  dark: {
    brand: '#4ADE80',
    brandSoft: '#162D20',
    onBrand: '#052E16',

    bg: '#09090B',
    surface: '#18181B',
    surfaceAlt: '#27272A',
    border: '#3F3F46',

    fg: '#FAFAFA',
    fgMuted: '#A1A1AA',
    fgSubtle: '#71717A',

    protein: '#F87171',
    carbs: '#FBBF24',
    fat: '#60A5FA',

    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },
} as const;

export type ColorSchemeName = keyof typeof palette;
export type ThemeColors = (typeof palette)[ColorSchemeName];

export function colorsFor(scheme: ColorSchemeName | null | undefined): ThemeColors {
  return palette[scheme === 'dark' ? 'dark' : 'light'];
}

/** Macro colors keyed by the macro's field name, for charts and legends. */
export function macroColors(scheme: ColorSchemeName | null | undefined) {
  const colors = colorsFor(scheme);

  return {
    protein: colors.protein,
    carbs: colors.carbs,
    fat: colors.fat,
  } as const;
}
