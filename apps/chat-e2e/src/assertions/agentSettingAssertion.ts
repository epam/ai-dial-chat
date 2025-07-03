import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { AgentSettings } from '@/src/ui/webElements';

export class AgentSettingAssertion extends BaseAssertion {
  readonly agentSettings: AgentSettings;

  constructor(agentSettings: AgentSettings) {
    super();
    this.agentSettings = agentSettings;
  }

  public async assertSystemPromptValue(expectedValue: string) {
    await this.agentSettings.systemPromptSpinner.waitForState({
      state: 'hidden',
    });
    const systemPrompt = this.agentSettings.systemPrompt;
    await this.assertElementText(
      systemPrompt,
      expectedValue,
      ExpectedMessages.systemPromptIsValid,
    );
  }
}
