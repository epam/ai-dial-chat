import { AgentUsageStats, DialAIEntityModel } from '@/chat/types/models';
import { API } from '@/src/testData';
import { Page } from '@playwright/test';

const UNLIMITED_LIMIT = 9e18;

export const defaultUnlimitedUsageStats: AgentUsageStats = {
  hourRequestStats: { total: UNLIMITED_LIMIT, used: 0 },
  dayRequestStats: { total: UNLIMITED_LIMIT, used: 0 },
  minuteTokenStats: { total: UNLIMITED_LIMIT, used: 0 },
  dayTokenStats: { total: UNLIMITED_LIMIT, used: 0 },
  weekTokenStats: { total: UNLIMITED_LIMIT, used: 0 },
  monthTokenStats: { total: UNLIMITED_LIMIT, used: 0 },
  minuteCostStats: { total: UNLIMITED_LIMIT, used: 0 },
  dayCostStats: { total: UNLIMITED_LIMIT, used: 0 },
  weekCostStats: { total: UNLIMITED_LIMIT, used: 0 },
  monthCostStats: { total: UNLIMITED_LIMIT, used: 0 },
};

export class ModelLimitsMockHelper {
  private readonly page: Page;
  private readonly model: DialAIEntityModel;

  constructor(page: Page, model: DialAIEntityModel) {
    this.page = page;
    this.model = model;
  }

  async mockLimitsResponse(
    stats: AgentUsageStats = defaultUnlimitedUsageStats,
  ): Promise<void> {
    await this.page.route(
      API.limitsHost(this.model.reference),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(stats),
        });
      },
    );
  }

  async removeLimitsMock(): Promise<void> {
    await this.page.unroute(API.limitsHost(this.model.reference));
  }
}
