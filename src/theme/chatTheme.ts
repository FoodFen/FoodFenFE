import type { PartialChatTheme } from '@kesha-antonov/react-native-chat';

import { colorsFor } from './colors';

/**
 * Maps this app's palette onto the chat library's theme API, which otherwise
 * defaults to its own Telegram-blue look regardless of `global.css`/
 * `colors.ts`. Only the colors an ordinary conversation actually shows are
 * overridden — reactions/overlay tints are translucent black/white in the
 * library's own defaults and read fine against any bubble color, so they're
 * left alone rather than reconstructed as ad-hoc rgba strings.
 */
function chatThemeFor(scheme: 'light' | 'dark'): PartialChatTheme {
  const colors = colorsFor(scheme);

  return {
    colors: {
      accent: colors.brand,
      background: colors.bg,
      incomingBubble: colors.surfaceAlt,
      outgoingBubble: colors.brand,
      incomingText: colors.fg,
      outgoingText: colors.onBrand,
      incomingMeta: colors.fgMuted,
      senderName: colors.fgMuted,
      separator: colors.border,
      inputBackground: colors.surfaceAlt,
      inputBarBackground: colors.surface,
      inputText: colors.fg,
      placeholder: colors.fgSubtle,
      dayPillText: colors.onBrand,
      surface: colors.surface,
      reactionBackground: colors.surfaceAlt,
    },
  };
}

export const chatLightTheme = chatThemeFor('light');
export const chatDarkTheme = chatThemeFor('dark');
