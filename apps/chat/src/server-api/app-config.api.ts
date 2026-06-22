import type { ClientConfigResponseDto } from '@epam/chat-api-client';
import { appConfigApi } from './api-client';

export const getClientConfig = (
  signal?: AbortSignal,
): Promise<ClientConfigResponseDto> =>
  appConfigApi.getClientConfig(
    { appId: 'chat-ui' },
    signal ? { signal } : undefined,
  );
