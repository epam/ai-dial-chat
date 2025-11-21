import { ReplaceConfirmationModalSelectors } from '@/src/ui/selectors/dialogSelectors';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ReplaceConfirmationDialog extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      ReplaceConfirmationModalSelectors.modalContainer,
      parentLocator,
    );
  }

  public cancelButton = this.getChildElementBySelector(
    ReplaceConfirmationModalSelectors.cancelButton,
  );

  public continueButton = this.getChildElementBySelector(
    ReplaceConfirmationModalSelectors.continueButton,
  );

  /**
   * Gets the dropdown menu button for a specific conversation by its name
   */
  private getConversationDropdownByName(conversationName: string) {
    return this.getElementLocator()
      .locator(
        ReplaceConfirmationModalSelectors.conversationByName(conversationName),
      )
      .locator(ReplaceConfirmationModalSelectors.dropdownTrigger);
  }

  /**
   * Gets the dropdown menu for "All items"
   */
  private getAllItemsDropdown() {
    return this.getChildElementBySelector(
      ReplaceConfirmationModalSelectors.allItemsSelector,
    ).getChildElementBySelector(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  /**
   * Clicks on a dropdown menu item (Replace, Postfix, Ignore)
   */
  private async selectDropdownOption(option: 'Replace' | 'Postfix' | 'Ignore') {
    const menuItem = this.page
      .locator(ReplaceConfirmationModalSelectors.menuItem)
      .filter({ hasText: option });
    await menuItem.click();
  }

  /**
   * Sets the resolution option for all items
   */
  public async setAllItemsOption(option: 'Replace' | 'Postfix' | 'Ignore') {
    await this.getAllItemsDropdown().click();
    await this.selectDropdownOption(option);
  }

  /**
   * Sets the resolution option for a specific conversation
   */
  public async setConversationOption(
    conversationName: string,
    option: 'Replace' | 'Postfix' | 'Ignore',
  ) {
    await this.getConversationDropdownByName(conversationName).click();
    await this.selectDropdownOption(option);
  }

  /**
   * Clicks the Continue button to proceed with import
   */
  public async clickContinue({
    isHttpMethodTriggered = true,
  }: { isHttpMethodTriggered?: boolean } = {}) {
    if (isHttpMethodTriggered) {
      const responsePromise = this.page.waitForResponse(
        (r) => r.request().method() === 'GET',
      );
      await this.continueButton.click();
      await responsePromise;
      const appContainer = new AppContainer(this.page);
      await appContainer
        .getImportExportLoader()
        .waitForState({ state: 'hidden' });
      await appContainer.waitForAppLoaded();
      await this.page.waitForLoadState('domcontentloaded');
    } else {
      await this.continueButton.click();
    }
  }

  /**
   * Clicks the Cancel button to cancel import
   */
  public async clickCancel() {
    await this.cancelButton.click();
  }
}
