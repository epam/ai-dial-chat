import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { AgentSettings } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class AgentSettingAssertion extends BaseAssertion {
  readonly agentSettings: AgentSettings;

  constructor(agentSettings: AgentSettings) {
    super();
    this.agentSettings = agentSettings;
  }

  public async assertSystemPromptValue(expectedValue: string) {
    const systemPrompt = await this.agentSettings.getSystemPrompt();
    expect
      .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
      .toBe(expectedValue);
  }
}
