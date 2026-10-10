import { useState } from 'react';
import type { ReactNode } from 'react';
import { PanResponder, View } from 'react-native';

import { cn } from '@/lib/cn';

export interface PaceSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  leftIcon: ReactNode;
  rightIcon: ReactNode;
  /** Which semantic color the fill and thumb ring use at the current value. */
  tone: 'success' | 'warning';
}

const THUMB_SIZE = 32;
const TRACK_HEIGHT = 8;

const FILL_CLASSES = { success: 'bg-success', warning: 'bg-warning' };
const RING_CLASSES = { success: 'border-success', warning: 'border-warning' };

/**
 * A drag-anywhere-on-the-track slider between two icons (turtle → rabbit for
 * pace). Built on `PanResponder` — React Native core — rather than a gesture
 * library; a single linear drag doesn't need one.
 */
export function PaceSlider({
  min,
  max,
  value,
  onChange,
  leftIcon,
  rightIcon,
  tone,
}: PaceSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)));

  function updateFromTouchX(x: number) {
    if (trackWidth === 0) return;

    const nextFraction = Math.min(1, Math.max(0, x / trackWidth));
    onChange(min + nextFraction * (max - min));
  }

  // Recreated each render so its handlers close over the current
  // `trackWidth`/`onChange` — cheap, and RN reads the latest render's handler
  // on every touch event, so an active drag is never interrupted by this.
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => updateFromTouchX(event.nativeEvent.locationX),
    onPanResponderMove: (event) => updateFromTouchX(event.nativeEvent.locationX),
  });

  return (
    <View className="w-full flex-row items-center gap-3">
      {leftIcon}

      <View
        className="relative flex-1 justify-center"
        style={{ height: THUMB_SIZE }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View
          className="absolute w-full rounded-full bg-surface-alt"
          style={{ height: TRACK_HEIGHT }}
        />
        <View
          className={cn('absolute rounded-full', FILL_CLASSES[tone])}
          style={{ height: TRACK_HEIGHT, width: `${fraction * 100}%` }}
        />
        <View
          className={cn('absolute rounded-full border-4 bg-bg', RING_CLASSES[tone])}
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: `${fraction * 100}%`,
            marginLeft: -THUMB_SIZE / 2,
          }}
        />
      </View>

      {rightIcon}
    </View>
  );
}
