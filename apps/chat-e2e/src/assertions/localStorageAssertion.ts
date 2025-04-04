import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';

export class LocalStorageAssertion extends BaseAssertion {
  private localStorageManager: LocalStorageManager;

  constructor(localStorageManager: LocalStorageManager) {
    super();
    this.localStorageManager = localStorageManager;
  }

  public async assertRecentModels(expectedModelIds: string[]) {
    const recentModels = await this.localStorageManager.getRecentModels();
    expect
      .soft(recentModels, ExpectedMessages.recentEntitiesIsValid)
      .toBe(JSON.stringify(expectedModelIds));
  }

  public async assertRecentModelsDoesNotContain(expectedModelId: string) {
    const recentModels = await this.localStorageManager.getRecentModels();
    expect
      .soft(recentModels, ExpectedMessages.recentEntitiesIsValid)
      .not.toContainEqual(expectedModelId);
  }
}
