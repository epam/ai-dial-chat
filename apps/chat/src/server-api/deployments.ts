import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import { deploymentsApi } from './api-client';

export const getDeploymentConfiguration = (
  deploymentName: string,
): Promise<DeploymentConfigurationSchema> =>
  deploymentsApi.getDeploymentConfiguration({
    deployment: deploymentName,
  }) as Promise<DeploymentConfigurationSchema>;
