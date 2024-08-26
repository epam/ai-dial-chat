import { ExpectedMessages } from '@/src/testData';
import { EntitySettings } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class EntitySettingAssertion {
  readonly entitySettings: EntitySettings;

  constructor(entitySettings: EntitySettings) {
    this.entitySettings = entitySettings;
  }

  public async assertSystemPromptValue(expectedValue: string) {
    const systemPrompt = await this.entitySettings.getSystemPrompt();
    expect
      .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
      .toBe(expectedValue);
  }
}
