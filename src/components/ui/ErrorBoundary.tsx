import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Short label naming what this guards, so the logged error is traceable. */
  name: string;
}

interface State {
  hasError: boolean;
}

/**
 * Stops a render error in a non-essential subtree from taking down the whole
 * app — React unmounts everything in the tree on an uncaught render error,
 * with no boundary to stop it, so a bug in a decorative component (a toast, a
 * banner) could otherwise block navigation happening elsewhere in the same
 * commit. React only offers this via a class component; there's no hook
 * equivalent for `getDerivedStateFromError`/`componentDidCatch`.
 *
 * Renders nothing once tripped, for the rest of the session, rather than
 * retrying — a decorative feature disappearing quietly beats it crashing
 * repeatedly.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) return null;

    return this.props.children;
  }
}
