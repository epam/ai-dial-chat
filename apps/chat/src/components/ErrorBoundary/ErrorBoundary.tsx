import { ErrorBoundary } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import {
  ButtonsI18nKeys,
  ErrorBoundaryI18nKeys,
} from '../../constants/translation-keys';

// ─── RootErrorBoundary ────────────────────────────────────────────────────────

interface RootErrorBoundaryProps {
  children: ReactNode;
}

// No `onReset`: the kit boundary reloads the page, since app state may be corrupt.
const RootErrorBoundaryInner: FC<RootErrorBoundaryProps> = ({ children }) => {
  const { t } = useTranslation();

  return (
    <ErrorBoundary
      title={t(ErrorBoundaryI18nKeys.Heading)}
      description={t(ErrorBoundaryI18nKeys.Description)}
      actionLabel={t(ErrorBoundaryI18nKeys.ReloadLabel)}
      onError={(error, info) =>
        console.error('[ErrorBoundary] Caught root error:', error, info)
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export const RootErrorBoundary = memo(RootErrorBoundaryInner);

// ─── RouteErrorBoundary ───────────────────────────────────────────────────────

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

const handleRouteReset = () => undefined;

const RouteErrorBoundaryInner: FC<RouteErrorBoundaryProps> = ({ children }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <ErrorBoundary
      title={t(ErrorBoundaryI18nKeys.Heading)}
      description={t(ErrorBoundaryI18nKeys.Description)}
      actionLabel={t(ButtonsI18nKeys.TryAgain)}
      onReset={handleRouteReset}
      resetKeys={[pathname]}
    >
      {children}
    </ErrorBoundary>
  );
};

export const RouteErrorBoundary = memo(RouteErrorBoundaryInner);
