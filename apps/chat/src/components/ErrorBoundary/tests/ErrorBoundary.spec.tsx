import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Link, MemoryRouter, useLocation } from 'react-router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { RootErrorBoundary, RouteErrorBoundary } from '../ErrorBoundary';

// react-i18next is globally mocked in test-setup.ts; t(key) returns the key string.

const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Render crash — internal details');
  return <p>Normal content</p>;
};

// ─── RootErrorBoundary ────────────────────────────────────────────────────────

describe('RootErrorBoundary', () => {
  let consoleErrorSpy: MockInstance;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  const renderRoot = (shouldThrow: boolean) =>
    render(
      <RootErrorBoundary>
        <ThrowingChild shouldThrow={shouldThrow} />
      </RootErrorBoundary>,
    );

  it('renders children when no error is thrown', () => {
    renderRoot(false);
    expect(screen.getByText('Normal content')).toBeTruthy();
  });

  it('renders the translated heading as the screen h1 and the description', () => {
    renderRoot(true);
    expect(
      screen.getByRole('heading', { level: 1, name: 'errorBoundary.heading' }),
    ).toBeTruthy();
    expect(screen.getByText('errorBoundary.description')).toBeTruthy();
  });

  it('announces the crash through an assertive live region', () => {
    renderRoot(true);
    expect(screen.getByRole('alert').textContent).toBe(
      'errorBoundary.heading',
    );
  });

  it('focuses the reload button without reloading automatically', () => {
    renderRoot(true);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'errorBoundary.reloadLabel' })
        .matches(':focus'),
    ).toBe(true);
  });

  it('reloads only after the user clicks the recovery button', async () => {
    renderRoot(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'errorBoundary.reloadLabel' }),
    );
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('does not render the raw error message in the DOM', () => {
    renderRoot(true);
    expect(screen.queryByText(/internal details/)).toBeNull();
  });
});

// ─── RouteErrorBoundary ───────────────────────────────────────────────────────

describe('RouteErrorBoundary', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const renderRoute = (pathname: string, shouldThrow: boolean) => (
    <MemoryRouter initialEntries={[pathname]}>
      <RouteErrorBoundary>
        <ThrowingChild shouldThrow={shouldThrow} />
      </RouteErrorBoundary>
    </MemoryRouter>
  );

  it('renders children normally when no error occurs', () => {
    render(renderRoute('/catalog', false));
    expect(screen.getByText('Normal content')).toBeTruthy();
  });

  it('shows the fallback with a try-again action when a child throws', () => {
    render(renderRoute('/catalog', true));
    expect(
      screen.getByRole('region', { name: 'errorBoundary.heading' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'buttons.tryAgain' }),
    ).toBeTruthy();
  });

  it('renders the children again when try again is clicked', async () => {
    let shouldThrow = true;
    const Flaky = () => <ThrowingChild shouldThrow={shouldThrow} />;
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <RouteErrorBoundary>
          <Flaky />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    shouldThrow = false;
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.tryAgain' }),
    );

    expect(screen.getByText('Normal content')).toBeTruthy();
  });

  it('shows the fallback again when the child throws again after try again', async () => {
    render(renderRoute('/catalog', true));

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.tryAgain' }),
    );

    expect(
      screen.getByRole('region', { name: 'errorBoundary.heading' }),
    ).toBeTruthy();
  });

  it('clears the error when the route changes', async () => {
    const RouteChild = () => (
      <ThrowingChild shouldThrow={useLocation().pathname === '/catalog'} />
    );
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <Link to="/conversations">Go to conversations</Link>
        <RouteErrorBoundary>
          <RouteChild />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('region', { name: 'errorBoundary.heading' }),
    ).toBeTruthy();

    await userEvent.click(
      screen.getByRole('link', { name: 'Go to conversations' }),
    );

    expect(screen.getByText('Normal content')).toBeTruthy();
  });
});
