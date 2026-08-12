import type {
  GetOfflineCredentialsResponseDto,
  OfflineCredentialsAuthResultDto,
  OfflineCredentialsSigninBodyDto,
} from '@epam/ai-dial-chat-api-client';
import { offlineCredentialsApi } from './api-client';

export const getOfflineCredentials = (
  signal?: AbortSignal,
): Promise<GetOfflineCredentialsResponseDto> =>
  offlineCredentialsApi.getOfflineCredentials(signal ? { signal } : undefined);

export const signInOfflineCredentials = (
  body: OfflineCredentialsSigninBodyDto,
): Promise<OfflineCredentialsAuthResultDto> =>
  offlineCredentialsApi.signInOfflineCredentials({
    offlineCredentialsSigninBodyDto: body,
  });
