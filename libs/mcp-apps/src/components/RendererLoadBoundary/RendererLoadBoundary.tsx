import { Component, type ReactNode } from 'react';

/** Props for the internal `RendererLoadBoundary`. */
export interface RendererLoadBoundaryProps {
  /** The lazily loaded renderer. */
  children: ReactNode;
  /** Called once when loading or rendering `children` throws. */
  onError: () => void;
}

interface RendererLoadBoundaryState {
  hasError: boolean;
}

/**
 * Catches a rejected renderer import (or a render error) under
 * `McpAppInlinePreview` and reports it through `onError`, rendering nothing
 * itself: the preview shows its own error state, so the announcing
 * `LiveRegion` stays outside this boundary. The preview keys it on its load
 * attempt, so a reload remounts it with a fresh import.
 */
export class RendererLoadBoundary extends Component<
  RendererLoadBoundaryProps,
  RendererLoadBoundaryState
> {
  override state: RendererLoadBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RendererLoadBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}
