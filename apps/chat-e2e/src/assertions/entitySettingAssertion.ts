import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { EntitySettings } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class EntitySettingAssertion extends BaseAssertion {
  readonly entitySettings: EntitySettings;

  constructor(entitySettings: EntitySettings) {
    super();
    this.entitySettings = entitySettings;
  }

  public async assertSystemPromptValue(expectedValue: string) {
    const systemPrompt = await this.entitySettings.getSystemPrompt();
    expect
      .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
      .toBe(expectedValue);
  }
}
