import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Button, LiveRegion, Spinner } from '@epam/ai-dial-ui-kit';
import { Component, Suspense, useState, type FC, type ReactNode } from 'react';
import styles from './LazyContentBoundary.module.scss';

/** User-visible strings for {@link LazyContentBoundary}. All fields have English defaults. */
interface LazyContentBoundaryLabels {
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
   * Rendered above the retry message when the lazy import
   * fails — e.g. a plain-text fallback that stays usable while retry is
   * offered. Omitted by default.
   */
  errorContent?: ReactNode;
  /** User-visible strings. All fields have English defaults. */
  labels?: LazyContentBoundaryLabels;
  /** Typography class of the retry message. Defaults to `'dial-body-text'`. */
  errorLabelClassName?: string;
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
    // eslint-disable-next-line no-restricted-syntax -- the pending state is the first thing mounted in its slot; a Suspense fallback cannot host a region mounted earlier
    role="status"
    aria-live="polite"
    className="flex h-full items-center justify-center"
  >
    {/* The kit Spinner is a status region of its own; hidden so regions don't nest. */}
    {pendingContent ?? (
      <span aria-hidden>
        <Spinner />
      </span>
    )}
    <span className="sr-only">{loadingLabel}</span>
  </div>
);

interface LazyContentErrorProps {
  errorLabel: string;
  retryLabel: string;
  onRetry: () => void;
  errorContent?: ReactNode;
  errorLabelClassName?: string;
}

/**
 * Retry state shared by lazy imports and asynchronous runtime preparation.
 * The visible message is hidden from assistive tech: the caller announces
 * `errorLabel` through a `LiveRegion` it keeps mounted across states.
 */
export const LazyContentError: FC<LazyContentErrorProps> = ({
  errorLabel,
  retryLabel,
  onRetry,
  errorContent,
  errorLabelClassName = 'dial-body-text',
}) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
    {errorContent}
    <div className="flex flex-col items-center gap-3 text-center">
      <p
        aria-hidden
        className={mergeClasses(errorLabelClassName, styles.errorLabel)}
      >
        {errorLabel}
      </p>
      <Button label={retryLabel} aria-label={retryLabel} onClick={onRetry} />
    </div>
  </div>
);

interface LazyContentErrorCatcherProps {
  /** The lazy-loaded subtree, wrapped in its `Suspense`. */
  children: ReactNode;
  /** Changing this value clears a previously caught error. */
  retryKey: number;
  /** Rendered in place of `children` after the import rejects. */
  errorFallback: ReactNode;
  /** Called once the wrapped import has rejected. */
  onError: () => void;
}

interface LazyContentErrorCatcherState {
  /** Whether the wrapped lazy import has thrown (a rejected dynamic import). */
  hasError: boolean;
}

/*
 * React remounts every child of an error boundary when it catches, so the
 * announcing `LiveRegion` lives in `LazyContentBoundary`, outside this class.
 */
class LazyContentErrorCatcher extends Component<
  LazyContentErrorCatcherProps,
  LazyContentErrorCatcherState
> {
  override state: LazyContentErrorCatcherState = { hasError: false };

  static getDerivedStateFromError(): LazyContentErrorCatcherState {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    this.props.onError();
  }

  override componentDidUpdate(prevProps: LazyContentErrorCatcherProps): void {
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
    return this.state.hasError ? this.props.errorFallback : this.props.children;
  }
}

/**
 * Wraps a `lazy()`-loaded component with an accessible pending state
 * (`role="status"`) and a retryable failure state announced through an
 * always-mounted `LiveRegion`.
 */
export const LazyContentBoundary: FC<LazyContentBoundaryProps> = ({
  children,
  retryKey,
  onRetry,
  pendingContent,
  errorContent,
  errorLabelClassName,
  labels: {
    loadingLabel = 'Loading…',
    errorLabel = 'Failed to load content',
    retryLabel = 'Retry',
  } = {},
}) => {
  const [failedRetryKey, setFailedRetryKey] = useState<number | null>(null);
  const hasError = failedRetryKey === retryKey;

  return (
    <>
      {/* Mounted while the import is pending or rendered, so a later failure is announced. */}
      <LiveRegion visuallyHidden>{hasError ? errorLabel : ''}</LiveRegion>
      <LazyContentErrorCatcher
        retryKey={retryKey}
        onError={() => setFailedRetryKey(retryKey)}
        errorFallback={
          <LazyContentError
            errorLabel={errorLabel}
            retryLabel={retryLabel}
            onRetry={onRetry}
            errorContent={errorContent}
            errorLabelClassName={errorLabelClassName}
          />
        }
      >
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
      </LazyContentErrorCatcher>
    </>
  );
};
