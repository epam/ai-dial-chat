import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { RootErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';

/*
 * A data router catches render errors in its own route boundary before they
 * reach anything wrapping `<RouterProvider>`, and shows React Router's default
 * error page with the raw stack. Wrapping the route element keeps render
 * errors inside `RootErrorBoundary` and its full-page fallback.
 */
export const buildAppRoutes = (root: ReactNode): RouteObject[] => [
  { path: '*', element: <RootErrorBoundary>{root}</RootErrorBoundary> },
];
