import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import type { DialDeploymentDto } from '@epam/chat-api-client';
import { deploymentsApi } from './api-client';

export const getDeployments = (): Promise<DialDeploymentDto[]> =>
  deploymentsApi.getDeployments();

export const getDeployment = (
  deploymentName: string,
): Promise<DialDeploymentDto> =>
  deploymentsApi.getDeployment({ deployment: deploymentName });

export const getDeploymentConfiguration = (
  deploymentName: string,
): Promise<DeploymentConfigurationSchema> =>
  deploymentsApi.getDeploymentConfiguration({
    deployment: deploymentName,
  }) as Promise<DeploymentConfigurationSchema>;
