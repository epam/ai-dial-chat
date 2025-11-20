import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ReplaceConfirmationDialog extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, '[data-qa="replace-confirmation-modal"]', parentLocator);
  }

  public cancelButton = this.getChildElementBySelector(
    'button.button-secondary',
  );

  public continueButton = this.getChildElementBySelector(
    'button.button-primary',
  );

  /**
   * Gets the dropdown menu button for a specific conversation by its name
   */
  private getConversationDropdownByName(conversationName: string) {
    return this.getElementLocator()
      .locator('[data-qa="conversation"]')
      .filter({
        has: this.page.locator(
          `[data-qa="entity-name"]:text("${conversationName}")`,
        ),
      })
      .locator('div[aria-haspopup="menu"]');
  }

  /**
   * Gets the dropdown menu for "All items"
   */
  public getAllItemsDropdown() {
    return this.getElementLocator()
      .locator('div.flex.h-fit.flex-row.items-center.justify-between')
      .first()
      .locator('div[aria-haspopup="menu"]');
  }

  /**
   * Clicks on a dropdown menu item (Replace, Postfix, Ignore)
   */
  private async selectDropdownOption(option: 'Replace' | 'Postfix' | 'Ignore') {
    // Wait for the dropdown menu to appear
    const menuItem = this.page
      .locator(`[role="menuitem"]`)
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
  public async clickContinue() {
    await this.continueButton.click();
  }

  /**
   * Clicks the Cancel button to cancel import
   */
  public async clickCancel() {
    await this.cancelButton.click();
  }
}
