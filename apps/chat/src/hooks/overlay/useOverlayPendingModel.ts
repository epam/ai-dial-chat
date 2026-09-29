import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import { useEffect } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';

/**
 * Applies the `modelId` the overlay host sent via `SET_OVERLAY_OPTIONS` to the
 * current selection once deployments are loaded, then clears it. No-op outside
 * overlay mode.
 *
 * OverlayContext (an ancestor of DeploymentsProvider) cannot call
 * useDeployments() itself, so the pending id is handed off here, where both
 * contexts are reachable. It is matched by id or by reference and silently
 * ignored when unknown — matches SET_OVERLAY_OPTIONS' "unknown modelId falls
 * back to normal default-deployment resolution".
 *
 * This only swaps the current selection in place. The overlay default for
 * every later new chat is DeploymentsContext's, which reads the same
 * `modelId` from OverlayContext, so clearing the pending id here does not let
 * `restoreDefaultSelection` fall back to another model.
 */
export const useOverlayPendingModel = (): void => {
  /*
   * Depends on the two fields it uses rather than the whole context value,
   * which changes on every unrelated overlay update (e.g. bridge registration).
   */
  const overlay = useOptionalOverlay();
  const pendingModelId = overlay?.pendingModelId ?? null;
  const clearPendingModelId = overlay?.clearPendingModelId;
  const { items, isLoading, restoreSelectedItemId } = useDeployments();

  useEffect(() => {
    if (!pendingModelId || !clearPendingModelId || isLoading) return;
    const deployment = findDeploymentByIdOrReference(items, pendingModelId);
    if (deployment) {
      restoreSelectedItemId(deployment.id);
    }
    clearPendingModelId();
  }, [
    pendingModelId,
    clearPendingModelId,
    items,
    isLoading,
    restoreSelectedItemId,
  ]);
};
