import type { BarcodeScanningResult } from 'expo-camera';
import { useCallback, useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * A rounded frame that follows the barcode in the live camera. Scan events fire
 * many times a second, so position and visibility live in shared values and
 * never touch React state; `useBarcodeFrame` hands the screen `update` (feed it
 * every scan result) and `onLost` (fires once no event arrived for `LOST_MS`).
 */

const LOST_MS = 600;
const MOVE_MS = 100;
const PADDING = 8;
const BORDER = 3;

type Box = { x: number; y: number; width: number; height: number };

// Axis-aligned box from the corners: iOS and Android order them differently.
function boxOf(result: BarcodeScanningResult): Box | null {
  const { cornerPoints, bounds } = result;

  if (cornerPoints?.length) {
    const xs = cornerPoints.map((point) => point.x);
    const ys = cornerPoints.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const width = Math.max(...xs) - x;
    const height = Math.max(...ys) - y;

    if (width > 0 && height > 0) return { x, y, width, height };
  }

  if (bounds && bounds.size.width > 0 && bounds.size.height > 0) {
    return { ...bounds.origin, ...bounds.size };
  }

  return null;
}

export function useBarcodeFrame(onLost: () => void) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  const shown = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLostRef = useRef(onLost);

  useEffect(() => {
    onLostRef.current = onLost;
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const update = useCallback(
    (result: BarcodeScanningResult) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        shown.current = false;
        opacity.set(withTiming(0, { duration: 150 }));
        onLostRef.current();
      }, LOST_MS);

      const box = boxOf(result);
      if (!box) return;

      const next = {
        x: box.x - PADDING,
        y: box.y - PADDING,
        width: box.width + PADDING * 2,
        height: box.height + PADDING * 2,
      };

      if (shown.current) {
        x.set(withTiming(next.x, { duration: MOVE_MS }));
        y.set(withTiming(next.y, { duration: MOVE_MS }));
        width.set(withTiming(next.width, { duration: MOVE_MS }));
        height.set(withTiming(next.height, { duration: MOVE_MS }));
      } else {
        shown.current = true;
        x.set(next.x);
        y.set(next.y);
        width.set(next.width);
        height.set(next.height);
        opacity.set(withTiming(1, { duration: 150 }));
      }
    },
    [x, y, width, height, opacity],
  );

  const style = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    opacity: opacity.value,
  }));

  return { update, style };
}

export function BarcodeFrame({
  style,
  color,
}: {
  style: ReturnType<typeof useBarcodeFrame>['style'];
  color: string;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          borderWidth: BORDER,
          borderRadius: 12,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}
