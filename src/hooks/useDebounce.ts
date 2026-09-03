import { useEffect, useState } from 'react';

/**
 * Debounce a fast-changing value — typically search input, so the catalog is
 * queried once the user pauses rather than once per keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
