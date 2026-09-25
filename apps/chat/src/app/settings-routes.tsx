import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route } from 'react-router';
import { RouteErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import { ROUTES } from '../types/routes';

const SettingsPage = lazy(
  async () => import('../pages/SettingsPage/SettingsPage'),
);

/*
 * The bare /settings URL and a per-tab one render the same shell: only the
 * shell knows which tabs are configured, so it resolves the default and
 * redirects a bare or unknown URL itself. Both paths are generated from one
 * gated element, so a settings path cannot be added that bypasses the gate or
 * mounts the lazy chunk while the page is hidden.
 */
export const renderSettingsRoutes = (
  isSettingsPageHidden: boolean,
): ReactElement<{ path: string }>[] =>
  [ROUTES.Settings, ROUTES.SettingsTab].map((path) => (
    <Route
      key={path}
      path={path}
      element={
        isSettingsPageHidden ? (
          <Navigate to={ROUTES.Root} replace />
        ) : (
          <RouteErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <SettingsPage />
            </Suspense>
          </RouteErrorBoundary>
        )
      }
    />
  ));
