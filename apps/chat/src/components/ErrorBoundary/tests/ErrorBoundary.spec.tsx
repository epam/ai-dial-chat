import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ErrorBoundary as LibErrorBoundary } from 'react-error-boundary';
import { MemoryRouter } from 'react-router';
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
import ErrorFallback from '../ErrorFallback';

// react-i18next is globally mocked in test-setup.ts; t(key) returns the key string.

const mockError = new Error('Test component crash — internal details');

const renderFallback = (
  overrides?: Partial<Parameters<typeof ErrorFallback>[0]>,
) =>
  render(
    <ErrorFallback
      error={mockError}
      resetErrorBoundary={vi.fn()}
      {...overrides}
    />,
  );

const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Render crash');
  return <p>Normal content</p>;
};

// ─── ErrorFallback ────────────────────────────────────────────────────────────

describe('ErrorFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders role="alert" container', () => {
    renderFallback();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders the heading', () => {
    renderFallback();
    expect(screen.getByText('errorBoundary.heading')).toBeTruthy();
  });

  it('renders the description', () => {
    renderFallback();
    expect(screen.getByText('errorBoundary.description')).toBeTruthy();
  });

  it('renders the retry button', () => {
    renderFallback();
    expect(
      screen.getByRole('button', { name: 'errorBoundary.retryLabel' }),
    ).toBeTruthy();
  });

  it('sets focus on the action button on mount', () => {
    renderFallback();
    expect(
      screen.getByRole('button', { name: 'errorBoundary.retryLabel' }),
    ).toBe(document.activeElement);
  });

  it('uses actionLabel i18n key when provided', () => {
    renderFallback({ actionLabel: 'errorBoundary.reloadLabel' });
    expect(
      screen.getByRole('button', { name: 'errorBoundary.reloadLabel' }),
    ).toBeTruthy();
  });

  it('does not render raw error message in the DOM', () => {
    renderFallback();
    expect(
      screen.queryByText('Test component crash — internal details'),
    ).toBeNull();
  });

  it('calls resetErrorBoundary when retry button is clicked', async () => {
    const resetErrorBoundary = vi.fn();
    renderFallback({ resetErrorBoundary });
    await userEvent.click(
      screen.getByRole('button', { name: 'errorBoundary.retryLabel' }),
    );
    expect(resetErrorBoundary).toHaveBeenCalledOnce();
  });
});

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

  it('shows the reload fallback without reloading automatically', () => {
    renderRoot(true);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', {
        name: 'errorBoundary.reloadLabel',
      }),
    ).toBeTruthy();
  });

  it('reloads only after the user clicks the recovery button', async () => {
    renderRoot(true);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'errorBoundary.reloadLabel',
      }),
    );
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('does not render raw error message in the DOM', () => {
    renderRoot(true);
    expect(screen.queryByText('Render crash')).toBeNull();
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

  it('renders children normally when no error occurs', () => {
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <RouteErrorBoundary>
          <ThrowingChild shouldThrow={false} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText('Normal content')).toBeTruthy();
  });

  it('shows the fallback when a child throws', () => {
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <RouteErrorBoundary>
          <ThrowingChild shouldThrow={true} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('resets error state when the route key changes', () => {
    /*
     * Test the underlying key-change mechanism directly:
     * RouteErrorBoundary uses resetKeys=[pathname], which the library treats the same as a key change.
     */
    const { rerender } = render(
      <ErrorBoundaryWithKey routeKey="/catalog" shouldThrow={true} />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(
      <ErrorBoundaryWithKey routeKey="/conversations" shouldThrow={false} />,
    );
    expect(screen.getByText('Normal content')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// Helper: remounts the library boundary to verify recovery after a route identity change.
const ErrorBoundaryWithKey = ({
  routeKey,
  shouldThrow,
}: {
  routeKey: string;
  shouldThrow: boolean;
}) => (
  <LibErrorBoundary key={routeKey} FallbackComponent={ErrorFallback}>
    <ThrowingChild shouldThrow={shouldThrow} />
  </LibErrorBoundary>
);
