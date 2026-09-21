import type {
  ExternalServiceAuthResultDto,
  ExternalServiceLogoutBodyDto,
  ExternalServiceSigninBodyDto,
  GetExternalServiceResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { externalServicesApi } from './api-client';

export type {
  ExternalServiceAuthResultDto,
  ExternalServiceLogoutBodyDto,
  ExternalServiceSigninBodyDto,
  GetExternalServiceResponseDto,
} from '@epam/ai-dial-chat-api-client';

export enum ExternalServiceAuthType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
  DialNative = 'DIAL_NATIVE',
}

export enum ExternalServiceCredentialsLevel {
  Global = 'GLOBAL',
  Application = 'APPLICATION',
  User = 'USER',
}

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
