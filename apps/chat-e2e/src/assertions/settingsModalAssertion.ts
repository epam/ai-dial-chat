import { DialAIEntityModel } from '@/chat/types/models';
import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { MenuAssertion } from '@/src/assertions/menuAssertion';
import {
  ElementState,
  ExpectedMessages,
  ThemeId,
  ToggleState,
  toTitleCase,
} from '@/src/testData';
import { SettingsModal } from '@/src/ui/webElements/settingsModal';
import { expect } from '@playwright/test';

export class SettingsModalAssertion extends BaseAssertion {
  readonly settingsModal: SettingsModal;
  readonly menuAssertion: MenuAssertion;

  constructor(settingsModal: SettingsModal) {
    super();
    this.settingsModal = settingsModal;
    this.menuAssertion = new MenuAssertion(
      this.settingsModal.getThemeDropdownMenu(),
    );
  }

  public async assertThemeValue(expectedTheme: ThemeId) {
    await this.assertElementText(
      this.settingsModal.theme,
      toTitleCase(expectedTheme),
      ExpectedMessages.applicationThemeIsValid,
    );
  }

  public async assertSaveButtonState(expectedState: ElementState) {
    await this.assertElementState(this.settingsModal.saveButton, expectedState);
  }

  public async assertThemeMenuOptions(...expectedOptions: string[]) {
    await this.menuAssertion.assertMenuIncludesOptions(...expectedOptions);
  }

  public async assertFullWidthChatToggleState(expectedState: ToggleState) {
    const state = expectedState === 'ON' ? ToggleState.on : ToggleState.off;
    await this.assertElementText(this.settingsModal.fullWidthChatToggle, state);
  }

  public async assertFullWidthChatToggleColor(expectedColor: string) {
    await this.assertElementColor(
      this.settingsModal.fullWidthChatToggleLabel,
      expectedColor,
    );
  }

  public async assertStartChatWithValue(
    expectedAgent:
      | DialAIEntityModel
      | { name: string; version?: string }
      | string,
  ) {
    const expectedValue = this.settingsModal.optionAttributes(expectedAgent);
    await this.assertElementText(
      this.settingsModal.startChatWithAgentAttributes,
      expectedValue,
    );
  }
}
