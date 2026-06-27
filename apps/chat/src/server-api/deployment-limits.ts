import type { DeploymentLimitsResponseDto } from '@epam/chat-api-client';
import { deploymentsApi } from './api-client';

export const getDeploymentLimits = (
  deploymentName: string,
): Promise<DeploymentLimitsResponseDto> =>
  deploymentsApi.getDeploymentLimits({ deployment: deploymentName });
