import { memo, type FC, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router';
import { ErrorBoundaryI18nKeys } from '../../constants/translation-keys';
import ErrorFallback, { type ErrorFallbackProps } from './ErrorFallback';

export type { ErrorFallbackProps };
export { ErrorBoundary };

// ─── RootErrorBoundary ────────────────────────────────────────────────────────

interface RootErrorBoundaryProps {
  children: ReactNode;
}

const RootErrorBoundaryInner: FC<RootErrorBoundaryProps> = ({ children }) => (
  <ErrorBoundary
    fallbackRender={({ error }) => (
      <ErrorFallback
        error={error}
        resetErrorBoundary={() => window.location.reload()}
        actionLabel={ErrorBoundaryI18nKeys.ReloadLabel}
      />
    )}
    onError={(error, info) =>
      console.error('[ErrorBoundary] Caught root error:', error, info)
    }
  >
    {children}
  </ErrorBoundary>
);

export const RootErrorBoundary = memo(RootErrorBoundaryInner);

// ─── RouteErrorBoundary ───────────────────────────────────────────────────────

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

const RouteErrorBoundaryInner: FC<RouteErrorBoundaryProps> = ({ children }) => {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[pathname]}>
      {children}
    </ErrorBoundary>
  );
};

export const RouteErrorBoundary = memo(RouteErrorBoundaryInner);
