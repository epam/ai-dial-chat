import type { ProviderInfoDto, UserProfileDto } from '@epam/ai-dial-chat-api-client';
import { authApi } from './api-client';
import {
  ApiEndpoints,
  clearCsrfToken,
  getCsrfToken,
  setCsrfToken,
} from './base';

export const getMe = async (): Promise<UserProfileDto> => {
  const raw = await authApi.getCurrentUserRaw({ cache: 'no-store' });
  const csrfToken = raw.raw.headers.get('x-csrf-token');
  if (csrfToken) setCsrfToken(csrfToken);
  return raw.value();
};

export const getProviders = (): Promise<Array<ProviderInfoDto>> =>
  authApi.listProviders();

export const logout = async (): Promise<void> => {
  const csrfToken = getCsrfToken();
  try {
    await fetch(ApiEndpoints.AUTH_LOGOUT, {
      method: 'POST',
      credentials: 'include',
      redirect: 'manual',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
    });
  } finally {
    clearCsrfToken();
  }
};
