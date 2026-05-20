import { ApiEndpoints, get } from './base';

export interface Deployment {
  id: string;
  [key: string]: unknown;
}

export interface DeploymentListResponse {
  data: Deployment[];
  [key: string]: unknown;
}

export const getDeployments = (): Promise<DeploymentListResponse> =>
  get<DeploymentListResponse>(ApiEndpoints.DEPLOYMENTS);

export const getDeployment = (deploymentName: string): Promise<Deployment> =>
  get<Deployment>(
    `${ApiEndpoints.DEPLOYMENTS}/${encodeURIComponent(deploymentName)}`,
  );
