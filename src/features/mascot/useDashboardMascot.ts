import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useMascotReactionStore } from '@/features/mascot/reactionStore';
import { useMascotState, type MascotBubble } from '@/features/mascot/useMascotState';
import type { MascotAction } from '@/lib/mascot';

/**
 * The dashboard's mascot: `useMascotState` limited to today, re-evaluated each time the
 * dashboard gains focus, with at most one bubble per focus (a fresh reaction always shows).
 */
export function useDashboardMascot(isToday: boolean): {
  action: MascotAction;
  bubble: MascotBubble;
  onBubbleDone: () => void;
} {
  const state = useMascotState();
  const [focused, setFocused] = useState(false);
  const [bubbleShown, setBubbleShown] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setBubbleShown(false);

      return () => setFocused(false);
    }, []),
  );

  const onBubbleDone = useCallback(() => {
    setBubbleShown(true);
    useMascotReactionStore.getState().clear();
  }, []);

  if (!isToday) return { action: 'idle', bubble: null, onBubbleDone };

  const bubble =
    focused && (state.bubble?.type === 'reaction' || !bubbleShown) ? state.bubble : null;

  return { action: state.action, bubble, onBubbleDone };
}
