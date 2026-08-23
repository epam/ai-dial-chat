import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { userApi } from './api-client';

export const getUserLimits = (): Promise<UserLimitStatsResponseDto> =>
  userApi.getUserLimits();

export const getUserUsage = (): Promise<UserLimitStatsResponseDto> =>
  userApi.getUserUsage();
