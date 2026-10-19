import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesI18nKeys } from '../../../constants/translation-keys';
import {
  UnsavedChangesProvider,
  useUnsavedChanges,
} from '../../../context/UnsavedChangesContext';
import { useBuilderLeaveGuard } from '../useBuilderLeaveGuard';

const Builder: FC<{ isDirty: boolean }> = ({ isDirty }) => {
  const { allowNextNavigation } = useBuilderLeaveGuard({ isDirty });
  return (
    <button type="button" onClick={allowNextNavigation}>
      Allow next navigation
    </button>
  );
};

/* Hands the guard's bypass to the spec, standing in for a save that completes in the background. */
const SavingBuilder: FC<{ onReady: (allow: () => void) => void }> = ({
  onReady,
}) => {
  const { allowNextNavigation } = useBuilderLeaveGuard({ isDirty: true });
  onReady(allowNextNavigation);
  return null;
};

const LogoutProbe: FC = () => {
  const { requestDiscard } = useUnsavedChanges();
  return (
    <button type="button" onClick={() => requestDiscard(() => undefined)}>
      Log out
    </button>
  );
};

const renderBuilder = ({
  isDirty = true,
  initialEntries = ['/catalog', '/builder'],
}: { isDirty?: boolean; initialEntries?: string[] } = {}) => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <UnsavedChangesProvider>
            <LogoutProbe />
            <Builder isDirty={isDirty} />
          </UnsavedChangesProvider>
        ),
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  return { router, ...render(<RouterProvider router={router} />) };
};

type MemoryRouter = ReturnType<typeof createMemoryRouter>;

const navigate = (
  router: MemoryRouter,
  to: string | number,
  options?: { replace?: boolean },
) =>
  act(async () => {
    if (typeof to === 'number') await router.navigate(to);
    else await router.navigate(to, options);
  });

describe('useBuilderLeaveGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets navigation through while the builder is clean', async () => {
    const { router } = renderBuilder({ isDirty: false });

    await navigate(router, '/scheduler');

    expect(router.state.location.pathname).toBe('/scheduler');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('blocks a PUSH while dirty and opens the dialog', async () => {
    const { router } = renderBuilder();

    await navigate(router, '/scheduler');

    expect(router.state.location.pathname).toBe('/builder');
    expect(
      screen.getByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
    ).toBeTruthy();
  });

  it('blocks a REPLACE while dirty', async () => {
    const { router } = renderBuilder();

    await navigate(router, '/scheduler', { replace: true });

    expect(router.state.location.pathname).toBe('/builder');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('blocks a POP (browser Back) while dirty', async () => {
    const { router } = renderBuilder();

    await navigate(router, -1);

    expect(router.state.location.pathname).toBe('/builder');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('blocks a search-only change while dirty', async () => {
    const { router } = renderBuilder();

    await navigate(router, '/builder?id=other');

    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('lets a hash-only change through while dirty', async () => {
    const { router } = renderBuilder();

    await navigate(router, '/builder#section');

    expect(router.state.location.hash).toBe('#section');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lands on the chosen location when Discard changes is chosen', async () => {
    const user = userEvent.setup();
    const { router } = renderBuilder();
    await navigate(router, '/scheduler?tab=mine');

    await user.click(
      screen.getByRole('button', { name: UnsavedChangesI18nKeys.ConfirmLabel }),
    );

    expect(router.state.location.pathname).toBe('/scheduler');
    expect(router.state.location.search).toBe('?tab=mine');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the location when Keep editing is chosen', async () => {
    const user = userEvent.setup();
    const { router } = renderBuilder();
    await navigate(router, '/scheduler');

    await user.click(
      screen.getByRole('button', { name: UnsavedChangesI18nKeys.CancelLabel }),
    );

    expect(router.state.location.pathname).toBe('/builder');
    expect(screen.queryByRole('dialog')).toBeNull();

    /* The blocker was reset, so the next attempt asks again. */
    await navigate(router, '/scheduler');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('lets exactly one transition through after allowNextNavigation', async () => {
    const user = userEvent.setup();
    const { router } = renderBuilder();

    await user.click(
      screen.getByRole('button', { name: 'Allow next navigation' }),
    );
    await navigate(router, '/builder?saved=1');
    expect(router.state.location.search).toBe('?saved=1');
    expect(screen.queryByRole('dialog')).toBeNull();

    await navigate(router, '/catalog');
    expect(router.state.location.pathname).toBe('/builder');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes the dialog when an in-flight save navigates away from the blocked builder', async () => {
    let allowNextNavigation: () => void = () => undefined;
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <UnsavedChangesProvider>
              <Outlet />
            </UnsavedChangesProvider>
          ),
          children: [
            {
              path: 'builder',
              element: (
                <SavingBuilder
                  onReady={(allow) => {
                    allowNextNavigation = allow;
                  }}
                />
              ),
            },
            { path: 'catalog', element: <p>Catalog</p> },
            { path: 'scheduler', element: <p>Scheduler</p> },
          ],
        },
      ],
      { initialEntries: ['/builder'] },
    );
    render(<RouterProvider router={router} />);

    /* The user leaves while the save is still running. */
    await navigate(router, '/scheduler');
    expect(screen.getByRole('dialog')).toBeTruthy();

    /* The save completes and runs the builder's post-save exit. */
    allowNextNavigation();
    await navigate(router, '/catalog');

    expect(router.state.location.pathname).toBe('/catalog');
    expect(screen.getByText('Catalog')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('registers a beforeunload warning only while dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderBuilder({ isDirty: false });
    expect(addSpy).not.toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });

  it('prevents unload while dirty and stops after a confirmed discard', async () => {
    const user = userEvent.setup();
    renderBuilder();

    const first = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await user.click(
      screen.getByRole('button', { name: UnsavedChangesI18nKeys.ConfirmLabel }),
    );

    const second = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
  });

  it('removes the beforeunload listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderBuilder();

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });
});
