import type {
  DeploymentsResponseDto,
  ListDeploymentsInterfaceTypeEnum,
} from '@epam/chat-api-client';
import { deploymentsApi } from './api-client';

export const getDeployments = (
  interfaceType?: string[],
  refresh?: boolean,
): Promise<DeploymentsResponseDto> =>
  deploymentsApi.listDeployments({
    interfaceType: interfaceType as Array<
      (typeof ListDeploymentsInterfaceTypeEnum)[keyof typeof ListDeploymentsInterfaceTypeEnum]
    >,
    refresh,
  });
