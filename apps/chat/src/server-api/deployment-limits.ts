import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { deploymentsApi } from './api-client';

export const getDeploymentLimits = (
  deploymentName: string,
): Promise<DeploymentLimitsResponseDto> =>
  deploymentsApi.getDeploymentLimits({ deployment: deploymentName });

export const getDeploymentUsage = (
  deploymentName: string,
): Promise<DeploymentLimitsResponseDto> =>
  deploymentsApi.getDeploymentUsage({ deployment: deploymentName });
