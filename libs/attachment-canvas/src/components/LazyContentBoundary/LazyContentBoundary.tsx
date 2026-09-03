import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Button, Spinner } from '@epam/ai-dial-ui-kit';
import { Component, Suspense, type FC, type ReactNode } from 'react';

/** User-visible strings for {@link LazyContentBoundary}. All fields have English defaults. */
export interface LazyContentBoundaryLabels {
  /** Accessible status text announced while the lazy content loads. Defaults to `'Loading…'`. */
  loadingLabel?: string;
  /** Message shown when the lazy content fails to load. Defaults to `'Failed to load content'`. */
  errorLabel?: string;
  /** Label and accessible name for the retry control. Defaults to `'Retry'`. */
  retryLabel?: string;
}

/** Props for {@link LazyContentBoundary}. */
export interface LazyContentBoundaryProps {
  /** The lazy-loaded content to render once ready. */
  children: ReactNode;
  /**
   * Changing this value clears a previously caught error. The caller must
   * pair it with recreating the `lazy()` reference passed as `children` —
   * React caches a rejected `lazy()` promise forever, so retrying only
   * works if a genuinely new `lazy()` component is mounted, not the same one
   * that already rejected.
   */
  retryKey: number;
  /**
   * Called when the user activates the retry control. The caller is
   * responsible for changing `retryKey` and recreating the `lazy()`
   * reference in response (see `retryKey`'s doc).
   */
  onRetry: () => void;
  /**
   * Rendered inside the `role="status"` region while the lazy import is
   * pending, alongside the accessible `loadingLabel`. Defaults to a
   * centered `Spinner`.
   */
  pendingContent?: ReactNode;
  /**
   * Rendered above the `role="alert"` retry message when the lazy import
   * fails — e.g. a plain-text fallback that stays usable while retry is
   * offered. Omitted by default.
   */
  errorContent?: ReactNode;
  /** User-visible strings. All fields have English defaults. */
  labels?: LazyContentBoundaryLabels;
}

interface LazyContentPendingProps {
  loadingLabel: string;
  pendingContent?: ReactNode;
}

/** Accessible pending state shared by lazy imports and asynchronous runtime preparation. */
export const LazyContentPending: FC<LazyContentPendingProps> = ({
  loadingLabel,
  pendingContent,
}) => (
  <div
    role="status"
    aria-live="polite"
    className="flex h-full items-center justify-center"
  >
    {pendingContent ?? <Spinner />}
    <span className="sr-only">{loadingLabel}</span>
  </div>
);

interface LazyContentErrorProps {
  errorLabel: string;
  retryLabel: string;
  onRetry: () => void;
  errorContent?: ReactNode;
}

/** Accessible retry state shared by lazy imports and asynchronous runtime preparation. */
export const LazyContentError: FC<LazyContentErrorProps> = ({
  errorLabel,
  retryLabel,
  onRetry,
  errorContent,
}) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
    {errorContent}
    <div role="alert" className="flex flex-col items-center gap-3 text-center">
      <p className={mergeClasses('dial-body-text', 'text-secondary')}>
        {errorLabel}
      </p>
      <Button label={retryLabel} aria-label={retryLabel} onClick={onRetry} />
    </div>
  </div>
);

interface LazyContentBoundaryState {
  /** Whether the wrapped lazy import has thrown (a rejected dynamic import). */
  hasError: boolean;
}

/**
 * Wraps a `lazy()`-loaded component with an accessible pending state
 * (`role="status"`) and a retryable failure state (`role="alert"`).
 */
export class LazyContentBoundary extends Component<
  LazyContentBoundaryProps,
  LazyContentBoundaryState
> {
  override state: LazyContentBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyContentBoundaryState {
    return { hasError: true };
  }

  override componentDidUpdate(prevProps: LazyContentBoundaryProps): void {
    /*
     * `retryKey` changes only when the caller has already recreated its
     * `lazy()` reference (see the prop's doc), so it's safe to clear the
     * caught error and let `children` — now backed by a fresh import —
     * render again.
     */
    if (prevProps.retryKey !== this.props.retryKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render(): ReactNode {
    const {
      children,
      onRetry,
      pendingContent,
      errorContent,
      labels: {
        loadingLabel = 'Loading…',
        errorLabel = 'Failed to load content',
        retryLabel = 'Retry',
      } = {},
    } = this.props;

    if (this.state.hasError) {
      return (
        <LazyContentError
          errorLabel={errorLabel}
          retryLabel={retryLabel}
          onRetry={onRetry}
          errorContent={errorContent}
        />
      );
    }

    return (
      <Suspense
        fallback={
          <LazyContentPending
            loadingLabel={loadingLabel}
            pendingContent={pendingContent}
          />
        }
      >
        {children}
      </Suspense>
    );
  }
}
