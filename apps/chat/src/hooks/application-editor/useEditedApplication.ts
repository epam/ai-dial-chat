import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import { useMemo, useState } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';

/** The deployment an application editor edits, and whether it is still being resolved. */
export interface EditedApplication {
  /** The matched deployment, fixed once first found. `undefined` in create mode or when never found. */
  deployment: DeploymentItemDto | undefined;
  /** True while in edit mode, no match has been found yet, and the deployments list is still loading. */
  isResolving: boolean;
}

/**
 * Resolves the deployment an application editor edits from the shared
 * deployments list.
 *
 * A just-accepted shared item can reach `DeploymentsContext` after the editor
 * opens, so the match is re-resolved on every list update until one is
 * found, then kept, so a later refetch never re-seeds in-progress edits. The
 * wait ends when the list finishes loading without a match.
 */
export const useEditedApplication = (appId: string): EditedApplication => {
  const { items, isLoading } = useDeployments();
  const [resolved, setResolved] = useState<{
    appId: string;
    deployment: DeploymentItemDto;
  } | null>(null);

  const match =
    appId && resolved?.appId !== appId
      ? findDeploymentByIdOrReference(items, appId)
      : undefined;

  // Adjust state during render: keep the first match for this id.
  if (match) {
    setResolved({ appId, deployment: match });
  }

  const deployment = resolved?.appId === appId ? resolved.deployment : match;

  return useMemo(
    () => ({
      deployment,
      isResolving: Boolean(appId) && !deployment && isLoading,
    }),
    [appId, deployment, isLoading],
  );
};
