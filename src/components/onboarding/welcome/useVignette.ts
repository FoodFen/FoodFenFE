import { useEffect, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const RESET_DELAY_MS = 500;

/** True while the slide is active and for a beat after it leaves, so the vignette restarts only once it is off screen. */
export function usePlayed(active: boolean, reducedMotion: boolean) {
  const [played, setPlayed] = useState(active);

  useEffect(() => {
    const id = setTimeout(() => setPlayed(active), active ? 0 : RESET_DELAY_MS);
    return () => clearTimeout(id);
  }, [active]);

  return reducedMotion || played;
}

/** A 0-1 linear clock that replays from 0 each time `played` turns true; pinned at 1 under reduced motion. */
export function useTimeline(played: boolean, reducedMotion: boolean, duration: number) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }

    progress.value = 0;
    if (played) progress.value = withTiming(1, { duration, easing: Easing.linear });

    return () => cancelAnimation(progress);
  }, [played, reducedMotion, duration, progress]);

  return progress;
}

/** Exponential ease-out of the 0-1 window [from, to] inside a timeline value. */
export function seg(progress: number, from: number, to: number) {
  'worklet';
  const t = Math.min(Math.max((progress - from) / (to - from), 0), 1);
  return Easing.out(Easing.exp)(t);
}

export interface VignetteProps {
  played: boolean;
  reducedMotion: boolean;
}
