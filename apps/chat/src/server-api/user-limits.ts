import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { userApi } from './api-client';

export const getUserUsage = (): Promise<UserLimitStatsResponseDto> =>
  userApi.getUserUsage();
