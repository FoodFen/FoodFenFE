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
    brand: '#16A34A',
    brandSoft: '#DCFCE7',
    onBrand: '#FFFFFF',

    bg: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceAlt: '#F3F4F6',
    border: '#E5E7EB',

    fg: '#111827',
    fgMuted: '#6B7280',
    fgSubtle: '#9CA3AF',

    protein: '#EF4444',
    carbs: '#F59E0B',
    fat: '#3B82F6',

    success: '#16A34A',
    warning: '#D97706',
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
