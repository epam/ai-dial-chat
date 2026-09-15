import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { CheckboxState, ExpectedMessages, ToggleState } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { AgentSettings } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { ConversationResponseFormat } from '@epam/ai-dial-shared';

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

  public async assertTemperature(expectedValue: string) {
    await this.assertElementText(
      this.agentSettings.getTemperatureSlider().slider,
      expectedValue,
      ExpectedMessages.temperatureIsValid,
    );
  }

  public async assertResponseFormat(format: ConversationResponseFormat) {
    await this.assertCheckboxState(
      this.agentSettings.getResponseFormatRadioButton(format),
      CheckboxState.checked,
    );
  }

  public async assertCompactModeToggleState(toggleState: ToggleState) {
    const switcher = this.agentSettings.compactModeToggle;
    await this.assertElementText(switcher, toggleState);
    const expectedBgColor =
      toggleState === ToggleState.on
        ? ThemeColorAttributes.bgAccentPrimary
        : ThemeColorAttributes.bgLayer4;
    await this.assertElementBackgroundColors(
      switcher,
      ThemesUtil.getRgbColorByKey(expectedBgColor),
    );
  }
}
