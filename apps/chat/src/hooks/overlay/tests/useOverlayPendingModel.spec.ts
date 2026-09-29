import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverlayPendingModel } from '../useOverlayPendingModel';

const mocks = vi.hoisted(() => ({
  overlay: undefined as
    | { pendingModelId: string | null; clearPendingModelId: () => void }
    | undefined,
  deployments: {
    items: [] as { id: string; reference?: string }[],
    isLoading: false,
    restoreSelectedItemId: vi.fn(),
  },
}));

vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => mocks.overlay,
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => mocks.deployments,
}));

const sigma = { id: 'sigma', reference: 'sigma-ref' };
const opus = { id: 'opus' };

describe('useOverlayPendingModel', () => {
  const clearPendingModelId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.overlay = { pendingModelId: 'sigma', clearPendingModelId };
    mocks.deployments.items = [opus, sigma];
    mocks.deployments.isLoading = false;
  });

  it('applies the pending model once deployments are loaded, then clears it', () => {
    renderHook(() => useOverlayPendingModel());

    expect(mocks.deployments.restoreSelectedItemId).toHaveBeenCalledWith(
      'sigma',
    );
    expect(clearPendingModelId).toHaveBeenCalledOnce();
  });

  it('waits while deployments are still loading', () => {
    mocks.deployments.isLoading = true;
    mocks.deployments.items = [];

    const { rerender } = renderHook(() => useOverlayPendingModel());

    expect(mocks.deployments.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(clearPendingModelId).not.toHaveBeenCalled();

    mocks.deployments.isLoading = false;
    mocks.deployments.items = [opus, sigma];
    rerender();

    expect(mocks.deployments.restoreSelectedItemId).toHaveBeenCalledWith(
      'sigma',
    );
  });

  it('resolves a pending deployment reference to its id', () => {
    mocks.overlay = { pendingModelId: 'sigma-ref', clearPendingModelId };

    renderHook(() => useOverlayPendingModel());

    expect(mocks.deployments.restoreSelectedItemId).toHaveBeenCalledWith(
      'sigma',
    );
  });

  it('clears an unknown pending model without changing the selection', () => {
    mocks.overlay = { pendingModelId: 'missing', clearPendingModelId };

    renderHook(() => useOverlayPendingModel());

    expect(mocks.deployments.restoreSelectedItemId).not.toHaveBeenCalled();
    expect(clearPendingModelId).toHaveBeenCalledOnce();
  });

  /*
   * A later SET_OVERLAY_OPTIONS sets a new pendingModelId, and this hook applies
   * it through restoreSelectedItemId — it is not gated on whether a selection
   * was already made explicitly.
   */
  it('applies a second modelId sent later in the session', () => {
    const { rerender } = renderHook(() => useOverlayPendingModel());
    expect(mocks.deployments.restoreSelectedItemId).toHaveBeenLastCalledWith(
      'sigma',
    );

    mocks.overlay = { pendingModelId: 'opus', clearPendingModelId };
    rerender();

    expect(mocks.deployments.restoreSelectedItemId).toHaveBeenLastCalledWith(
      'opus',
    );
    expect(clearPendingModelId).toHaveBeenCalledTimes(2);
  });

  it('does not re-run when the overlay context changes without a new pending model', () => {
    const { rerender } = renderHook(() => useOverlayPendingModel());
    mocks.overlay = { pendingModelId: null, clearPendingModelId };
    rerender();
    mocks.overlay = { pendingModelId: null, clearPendingModelId };
    rerender();

    expect(mocks.deployments.restoreSelectedItemId).toHaveBeenCalledOnce();
    expect(clearPendingModelId).toHaveBeenCalledOnce();
  });

  it('does nothing outside overlay mode', () => {
    mocks.overlay = undefined;

    renderHook(() => useOverlayPendingModel());

    expect(mocks.deployments.restoreSelectedItemId).not.toHaveBeenCalled();
  });
});
