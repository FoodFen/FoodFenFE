import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { GlassViewProps } from 'expo-glass-effect';
import { cssInterop } from 'nativewind';
import type { ComponentType } from 'react';
import { Platform, View } from 'react-native';
import type { ColorValue, StyleProp, ViewProps, ViewStyle } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';

/** True on iOS 26+, where `GlassView` is real Liquid Glass; elsewhere it is a plain view. */
export const hasLiquidGlass = isLiquidGlassAvailable();

cssInterop(GlassView, { className: 'style' });
// cssInterop adds `className` at runtime; GlassViewProps does not declare it.
const StyledGlassView = GlassView as ComponentType<
  GlassViewProps & { className?: string }
>;

const FALLBACK_SHADOW: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 6 },
});

export interface GlassSurfaceProps extends ViewProps {
  className?: string;
  /** Replaces the default `bg-surface border border-border` look when glass is unavailable. */
  fallbackClassName?: string;
  style?: StyleProp<ViewStyle>;
  tintColor?: ColorValue;
  interactive?: boolean;
}

/** iOS 26 Liquid Glass where available, a shadowed solid surface everywhere else. */
export function GlassSurface({
  className,
  fallbackClassName = 'bg-surface border border-border',
  style,
  tintColor,
  interactive,
  children,
  ...props
}: GlassSurfaceProps) {
  const { resolved } = useAppTheme();

  if (hasLiquidGlass) {
    return (
      <StyledGlassView
        glassEffectStyle="regular"
        colorScheme={resolved}
        tintColor={tintColor}
        isInteractive={interactive}
        className={className}
        style={style}
        {...props}
      >
        {children}
      </StyledGlassView>
    );
  }

  return (
    <View
      className={cn(className, fallbackClassName)}
      style={[FALLBACK_SHADOW, style]}
      {...props}
    >
      {children}
    </View>
  );
}
