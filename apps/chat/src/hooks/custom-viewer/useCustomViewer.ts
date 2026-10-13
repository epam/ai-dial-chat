import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import { useMemo } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import type { CustomViewer } from '../../models/custom-viewer';
import { resolveCustomViewer } from '../../utils/custom-viewer';

/** Result of {@link useCustomViewer}. */
export interface UseCustomViewerResult {
  /** The viewer configured for the deployment, or `undefined` when it uses the normal chat UI. */
  viewer: CustomViewer | undefined;
  /** True while deployments and schemas are still loading, so the answer is not final yet. */
  isResolving: boolean;
}

/**
 * Resolves the Custom Viewer for a deployment id (or reference).
 *
 * Exists so the conversation page and the new-chat route apply one rule —
 * direct `viewerUrl` first, then the application schema's — over the same
 * deployments and schemas `DeploymentsContext` already loads, and so both can
 * hold their own loading state instead of flashing the plain chat while the
 * lists are still in flight.
 */
export const useCustomViewer = (
  deploymentId: string | null | undefined,
): UseCustomViewerResult => {
  const { items, schemas, isLoading } = useDeployments();

  const viewer = useMemo(
    () =>
      resolveCustomViewer(
        findDeploymentByIdOrReference(items, deploymentId),
        schemas,
      ),
    [items, schemas, deploymentId],
  );

  return { viewer, isResolving: isLoading };
};
