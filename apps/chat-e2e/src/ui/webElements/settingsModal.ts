import { Styles, Tags } from '@/src/ui/domData';
import { IconSelectors } from '@/src/ui/selectors';
import { AccountSettingsModalSelector } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Locator, Page } from '@playwright/test';

export class SettingsModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, AccountSettingsModalSelector.settingsModal, parentLocator);
  }

  private themeDropdownMenu!: DropdownButtonMenu;

  getThemeDropdownMenu(): DropdownButtonMenu {
    if (!this.themeDropdownMenu) {
      this.themeDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.themeDropdownMenu;
  }

  public theme = this.getChildElementBySelector(
    AccountSettingsModalSelector.theme,
  );
  public customLogo = this.getChildElementBySelector(
    AccountSettingsModalSelector.customLogo,
  );

  public fullWidthChatToggle = this.getChildElementBySelector(
    AccountSettingsModalSelector.fullWidthChatToggle,
  );

  public saveButton = this.getChildElementBySelector(
    AccountSettingsModalSelector.save,
  );
  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );

  public async getFullWidthChatToggleColor() {
    const toggleColor = await this.fullWidthChatToggle
      .getChildElementBySelector(Tags.label)
      .getComputedStyleProperty(Styles.backgroundColor);
    return toggleColor[0];
  }
}
