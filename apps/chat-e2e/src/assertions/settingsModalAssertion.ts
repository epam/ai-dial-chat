import { MenuAssertion } from '@/src/assertions/menuAssertion';
import {
  ElementState,
  ExpectedMessages,
  Theme,
  ToggleState,
  toTitleCase,
} from '@/src/testData';
import { SettingsModal } from '@/src/ui/webElements/settingsModal';
import { expect } from '@playwright/test';

export class SettingsModalAssertion {
  readonly settingsModal: SettingsModal;
  readonly menuAssertion: MenuAssertion;

  constructor(settingsModal: SettingsModal) {
    this.settingsModal = settingsModal;
    this.menuAssertion = new MenuAssertion(
      this.settingsModal.getThemeDropdownMenu(),
    );
  }

  public async assertThemeValue(expectedTheme: Theme) {
    expect
      .soft(
        await this.settingsModal.theme.getElementInnerContent(),
        ExpectedMessages.applicationThemeIsValid,
      )
      .toBe(toTitleCase(expectedTheme));
  }

  public async assertSaveButtonState(expectedState: ElementState) {
    const saveBtn = this.settingsModal.saveButton.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(saveBtn, ExpectedMessages.buttonIsVisible)
          .toBeVisible()
      : await expect
          .soft(saveBtn, ExpectedMessages.buttonIsNotVisible)
          .toBeHidden();
  }

  public async assertThemeMenuOptions(...expectedOptions: string[]) {
    await this.menuAssertion.assertMenuIncludesOptions(...expectedOptions);
  }

  public async assertFullWidthChatToggleState(expectedState: ToggleState) {
    const toggleState =
      await this.settingsModal.fullWidthChatToggle.getElementInnerContent();
    expectedState === 'ON'
      ? expect
          .soft(toggleState, ExpectedMessages.featureIsToggledOn)
          .toBe(ToggleState.on)
      : expect
          .soft(toggleState, ExpectedMessages.featureIsToggledOff)
          .toBe(ToggleState.off);
  }

  public async assertFullWidthChatToggleColor(expectedColor: string) {
    expect
      .soft(
        await this.settingsModal.getFullWidthChatToggleColor(),
        ExpectedMessages.elementColorIsValid,
      )
      .toBe(expectedColor);
  }
}
