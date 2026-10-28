import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';

/**
 * Whether a deployment may be preselected for a new chat from a link: not hidden
 * by the operator, and offering the `chat` interface (or declaring no interfaces).
 * Mirrors the catalog's `supportsChat`, which hides "Use in chat" for the rest.
 * @param deployment - deployment to check
 */
export const isDeepLinkableDeployment = (
  deployment: Pick<DeploymentItemDto, 'isHidden' | 'interfaces'>,
): boolean =>
  !deployment.isHidden &&
  (deployment.interfaces == null || deployment.interfaces.includes('chat'));
