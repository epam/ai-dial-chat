import type { ProviderInfoDto, UserProfileDto } from '@epam/chat-api-client';
import { authApi } from './api-client';
import { setCsrfToken } from './base';

export const getMe = async (): Promise<UserProfileDto> => {
  const raw = await authApi.getCurrentUserRaw();
  const csrfToken = raw.raw.headers.get('x-csrf-token');
  if (csrfToken) setCsrfToken(csrfToken);
  return raw.value();
};

export const getProviders = (): Promise<Array<ProviderInfoDto>> =>
  authApi.listProviders();
