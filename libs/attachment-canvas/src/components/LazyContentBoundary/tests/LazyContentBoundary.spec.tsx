import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, useMemo, useState, type FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyContentBoundary } from '../LazyContentBoundary';

/*
 * `lazy()` calls its factory at most once and caches a rejected promise
 * forever, so recreating the `lazy()` reference (not just resetting the
 * error boundary) is the only way a retry can genuinely re-attempt the
 * import. This harness mirrors how `AttachmentCanvasBody`/`CodeContent`
 * recreate their `lazy()` reference from a `retryKey`-keyed `useMemo`.
 */
const TestHarness: FC<{ factory: () => Promise<{ default: FC }> }> = ({
  factory,
}) => {
  const [retryKey, setRetryKey] = useState(0);
  const LazyChild = useMemo(() => lazy(factory), [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleRetry = () => setRetryKey((key) => key + 1);

  return (
    <LazyContentBoundary
      retryKey={retryKey}
      onRetry={handleRetry}
      labels={{
        loadingLabel: 'Loading…',
        errorLabel: 'Failed to load content',
        retryLabel: 'Retry',
      }}
    >
      <LazyChild />
    </LazyContentBoundary>
  );
};

describe('LazyContentBoundary', () => {
  it('renders a role="status" pending state while the import is in flight', () => {
    const neverResolves = () => new Promise<{ default: FC }>(() => undefined);
    render(<TestHarness factory={neverResolves} />);

    // `Spinner` itself also renders a nested `role="status"`; asserting at
    // least one confirms the pending region is announced without depending
    // on that implementation detail.
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('renders a role="alert" with a retry control when the import rejects', async () => {
    const factory = vi.fn(() => Promise.reject(new Error('boom')));
    render(<TestHarness factory={factory} />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('re-attempts the import on retry instead of replaying the cached rejection, and renders the real content once it succeeds', async () => {
    const factory = vi
      .fn<() => Promise<{ default: FC }>>()
      .mockImplementationOnce(() => Promise.reject(new Error('boom')))
      .mockImplementation(() =>
        Promise.resolve({ default: () => <div>Loaded content</div> }),
      );
    render(<TestHarness factory={factory} />);

    await screen.findByRole('alert');
    expect(factory).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Loaded content')).toBeTruthy();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
