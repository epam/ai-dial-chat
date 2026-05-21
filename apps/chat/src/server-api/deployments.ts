import type { DialDeploymentDto } from '@epam/chat-api-client';
import { deploymentsApi } from './api-client';

export const getDeployments = (): Promise<DialDeploymentDto[]> =>
  deploymentsApi.getDeployments();

export const getDeployment = (
  deploymentName: string,
): Promise<DialDeploymentDto> =>
  deploymentsApi.getDeployment({ deployment: deploymentName });
