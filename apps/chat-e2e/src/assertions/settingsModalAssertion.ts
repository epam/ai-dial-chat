import { DialAIEntityModel } from '@/chat/types/models';
import { EnterType } from '@/chat/types/settings';
import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { MenuAssertion } from '@/src/assertions/menuAssertion';
import {
  CheckboxState,
  ElementState,
  ExpectedMessages,
  ThemeId,
  ToggleState,
  toTitleCase,
} from '@/src/testData';
import { SettingsModal } from '@/src/ui/webElements/settingsModal';

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
    await this.assertElementText(
      this.settingsModal.fullWidthChatToggle,
      expectedState,
    );
  }

  public async assertFullWidthChatToggleColor(expectedColor: string) {
    await this.assertElementBackgroundColors(
      this.settingsModal.fullWidthChatToggleLabel,
      expectedColor,
    );
  }

  public async assertKeyboardShortcutsCount(expectedCount: number) {
    await this.assertElementsCount(
      this.settingsModal.keyboardShortcutRadioButton,
      expectedCount,
    );
  }

  public async assertKeyboardShortcutState(
    value: EnterType,
    expectedState: CheckboxState,
  ) {
    await this.assertCheckboxState(
      this.settingsModal.keyboardShortcutRadioButtonByValue(value),
      expectedState,
    );
  }

  public async assertKeyboardShortcutRadioButtonLabel(
    value: string,
    expectedLabel: string,
  ) {
    await this.assertElementText(
      this.settingsModal.keyboardShortcutRadioButtonByValueLabel(value),
      expectedLabel,
    );
  }

  public async assertStartChatWithSelectedValue(
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
