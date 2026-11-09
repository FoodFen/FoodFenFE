import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';

import { TOUR_STEPS, useTourStore } from '@/features/tour/store';
import type { TourTargetId } from '@/features/tour/store';

/**
 * Registers a view as a tour target. Spread the result onto a plain `View`
 * wrapping the target; `collapsable: false` keeps Android from flattening the
 * view away, which would make it unmeasurable. Re-measures when the tour
 * reaches this target because entrance animations move things after layout.
 */
export function useTourTarget(id?: TourTargetId) {
  const ref = useRef<View>(null);
  const setRect = useTourStore((state) => state.setRect);
  const isCurrent = useTourStore(
    (state) => id !== undefined && state.active && TOUR_STEPS[state.step] === id,
  );

  const measure = useCallback(() => {
    if (id === undefined) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setRect(id, { x, y, width, height });
    });
  }, [id, setRect]);

  useEffect(() => {
    if (!isCurrent) return;
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [isCurrent, measure]);

  return { ref, onLayout: measure, collapsable: false as const };
}
