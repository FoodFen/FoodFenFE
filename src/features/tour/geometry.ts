import type { TourRect } from './store';

/** Padding around the target, and the corner radius for large targets. */
const SPOTLIGHT_PADDING = 8;
const SMALL_TARGET = 80;
const LARGE_RADIUS = 20;

export type Spotlight = TourRect & { radius: number };

/** A target padded by 8; small targets become circles/pills, large ones get a fixed radius. */
export function spotlightFor(rect: TourRect): Spotlight {
  const width = rect.width + SPOTLIGHT_PADDING * 2;
  const height = rect.height + SPOTLIGHT_PADDING * 2;
  const shorter = Math.min(width, height);

  return {
    x: rect.x - SPOTLIGHT_PADDING,
    y: rect.y - SPOTLIGHT_PADDING,
    width,
    height,
    radius: shorter <= SMALL_TARGET ? shorter / 2 : LARGE_RADIUS,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Dim-layer outline as one path: a rect far larger than any screen with the
 * rounded spotlight rect punched out under the even-odd fill rule. A zero-size
 * spotlight leaves a degenerate hole, i.e. a plain dim.
 */
export function overlayPath(x: number, y: number, w: number, h: number, r: number): string {
  'worklet';
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    'M-5000 -5000H10000V10000H-5000Z' +
    `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}` +
    `V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}` +
    `H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}` +
    `V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`
  );
}
