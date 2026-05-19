import { get } from './base';

export interface Deployment {
  id: string;
  [key: string]: unknown;
}

export interface DeploymentListResponse {
  data: Deployment[];
  [key: string]: unknown;
}

export const getDeployments = (): Promise<DeploymentListResponse> =>
  get<DeploymentListResponse>('/api/deployments');

export const getDeployment = (deploymentName: string): Promise<Deployment> =>
  get<Deployment>(`/api/deployments/${encodeURIComponent(deploymentName)}`);
