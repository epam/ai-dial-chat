import type {
  ApplicationExternalServiceDto,
  ExternalServiceAuthResultDto,
  ExternalServiceLogoutBodyDto,
  ExternalServiceSigninBodyDto,
  GetExternalServiceResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { externalServicesApi } from './api-client';

/** An application's public external-service listing, OAuth client settings included (never secrets). */
export const listExternalServices = (
  appId: string,
): Promise<ApplicationExternalServiceDto[]> =>
  externalServicesApi.listExternalServices({ appId });

export const getExternalService = (
  appId: string,
  serviceId: string,
): Promise<GetExternalServiceResponseDto> =>
  externalServicesApi.getExternalService({ appId, serviceId });

export const signInExternalService = (
  appId: string,
  serviceId: string,
  body: ExternalServiceSigninBodyDto,
): Promise<ExternalServiceAuthResultDto> =>
  externalServicesApi.signInExternalService({
    appId,
    serviceId,
    externalServiceSigninBodyDto: body,
  });

export const signOutExternalService = (
  appId: string,
  serviceId: string,
  body: ExternalServiceLogoutBodyDto,
): Promise<ExternalServiceAuthResultDto> =>
  externalServicesApi.signOutExternalService({
    appId,
    serviceId,
    externalServiceLogoutBodyDto: body,
  });
