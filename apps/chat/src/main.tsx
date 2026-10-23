import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-react-file-manager/styles.css';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { buildAppRoutes } from './app-routes';
import AppRoot from './AppRoot';
import { RootErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import './i18n/config';
import './tailwind.css';
import './styles.scss';
import { registerChunkLoadRecovery } from './utils/chunk-load-recovery';

registerChunkLoadRecovery();

/*
 * A data router is required for `useBlocker` (the builder leave guard). The
 * single splat route renders the unchanged provider stack and descendant
 * `<Routes>`, so no route declaration moves into a route-object tree. The
 * outer `RootErrorBoundary` below only covers what renders outside the router.
 */
const router = createBrowserRouter(buildAppRoutes(<AppRoot />));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <RootErrorBoundary>
      {/*
       * The ui-kit `InteractiveTooltip` portals its panel into a host-provided
       * container with this id (floating-ui resolves a `FloatingPortal` id via
       * `document.getElementById`); without the container the panel silently
       * renders nothing. Theme vars and `dir` are set on `documentElement`,
       * so the portaled panels inherit both from here.
       */}
      <div id="interactive-tooltip-portal" />
      <RouterProvider router={router} />
    </RootErrorBoundary>
  </StrictMode>,
);
