import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { supportsChatInterface } from '@epam/ai-dial-chat-hooks';

/**
 * Whether a deployment may be preselected for a new chat from a link: not hidden
 * by the operator, and chat-capable by the same rule as the catalog's
 * `supportsChat`, which hides "Use in chat" for the rest.
 * @param deployment - deployment to check
 */
export const isDeepLinkableDeployment = (
  deployment: Pick<DeploymentItemDto, 'isHidden' | 'interfaces'>,
): boolean => !deployment.isHidden && supportsChatInterface(deployment);
