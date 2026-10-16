import { act, render, type RenderResult } from '@testing-library/react';
import { useEffect, useReducer, type FC, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { UnsavedChangesProvider } from '../../../context/UnsavedChangesContext';

interface RenderWithLeaveGuardResult extends RenderResult {
  /** The memory router driving the rendered tree. */
  router: ReturnType<typeof createMemoryRouter>;
  /** Re-renders the route tree in place, re-invoking a `routes` factory. */
  rerenderRoutes: () => void;
}

interface RoutesHostProps {
  renderRoutes: () => ReactNode;
  onForceUpdate: (forceUpdate: () => void) => void;
}

/* Re-invokes `renderRoutes` on demand, so a spec can re-render the tree after changing a mock. */
const RoutesHost: FC<RoutesHostProps> = ({ renderRoutes, onForceUpdate }) => {
  const [, forceUpdate] = useReducer((tick: number) => tick + 1, 0);
  useEffect(() => onForceUpdate(forceUpdate), [onForceUpdate]);
  return renderRoutes();
};

/**
 * Renders a builder page's route tree the way the app mounts it: under a data
 * router (required by `useBlocker`) and inside `UnsavedChangesProvider`, which
 * owns the shared unsaved-changes dialog. Returns the memory router so a spec
 * can drive PUSH/POP transitions and read the current location, plus
 * `rerenderRoutes`, which re-renders the tree (for example after a mock's
 * return value changed) without remounting it.
 */
export const renderWithLeaveGuard = (
  routes: ReactNode | (() => ReactNode),
  initialEntries: string[] = ['/'],
): RenderWithLeaveGuardResult => {
  let forceUpdate: () => void = () => undefined;
  const renderRoutes = typeof routes === 'function' ? routes : () => routes;
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <UnsavedChangesProvider>
            <RoutesHost
              renderRoutes={renderRoutes}
              onForceUpdate={(update) => {
                forceUpdate = update;
              }}
            />
          </UnsavedChangesProvider>
        ),
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  const utils = render(<RouterProvider router={router} />);
  const rerenderRoutes = () => act(() => forceUpdate());
  return { router, rerenderRoutes, ...utils };
};
