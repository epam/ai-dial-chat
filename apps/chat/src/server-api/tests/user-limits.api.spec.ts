import type { UserLimitStatsResponseDto } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userApi } from '../api-client';
import { getUserUsage } from '../user-limits';

vi.mock('../api-client', () => ({
  userApi: {
    getUserUsage: vi.fn(),
  },
}));

const mockUsage: UserLimitStatsResponseDto = {
  deployments: {
    'llm-router': { dayCostStats: { total: 2 ** 63, used: 1.5 } },
  },
  dayCostStats: { total: 100, used: 1.5 },
};

describe('getUserUsage', () => {
  beforeEach(() => {
    vi.mocked(userApi.getUserUsage).mockReset();
  });

  it('leaves the reported deployment kinds to the server default', async () => {
    vi.mocked(userApi.getUserUsage).mockResolvedValue(mockUsage);

    await getUserUsage();

    expect(userApi.getUserUsage).toHaveBeenCalledTimes(1);
    expect(userApi.getUserUsage).toHaveBeenCalledWith();
  });

  it('returns the generated client response untransformed', async () => {
    vi.mocked(userApi.getUserUsage).mockResolvedValue(mockUsage);

    await expect(getUserUsage()).resolves.toBe(mockUsage);
  });
});
