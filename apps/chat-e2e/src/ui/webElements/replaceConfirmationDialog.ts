import { ImportResolutionOption } from '@/src/testData';
import { FolderSelectors } from '@/src/ui/selectors';
import { ReplaceConfirmationModalSelectors } from '@/src/ui/selectors/dialogSelectors';
import { EntitySelectors } from '@/src/ui/selectors/entitySelectors';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { RegexUtil } from '@/src/utils';
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

  public allItemsLine = this.getChildElementBySelector(
    ReplaceConfirmationModalSelectors.allItemsSelector,
  );

  public getConversationDropdownByName(conversationName: string) {
    return this.getConversationRowByName(
      conversationName,
    ).getChildElementBySelector(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  private getConversationRowByName(conversationName: string) {
    return this.getChildElementBySelector(
      `${EntitySelectors.conversation}:has(${EntitySelectors.entityName}:text("${conversationName}"))`,
    );
  }

  /**
   * Gets the dropdown menu for "All items"
   */
  public getAllItemsDropdown() {
    return this.allItemsLine.getChildElementBySelector(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  /**
   * Clicks on a dropdown menu item (Replace, Postfix, Ignore)
   */
  private async selectDropdownOption(option: ImportResolutionOption) {
    const menuItem = this.page
      .locator(ReplaceConfirmationModalSelectors.menuItem)
      .filter({ hasText: option });
    await menuItem.click();
  }

  /**
   * Sets the resolution option for all items
   */
  public async setAllItemsOption(option: ImportResolutionOption) {
    await this.getAllItemsDropdown().click();
    await this.selectDropdownOption(option);
  }

  /**
   * Sets the resolution option for a specific conversation
   */
  public async setConversationOption(
    conversationName: string,
    option: ImportResolutionOption,
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

  public getConversationByExactName(name: string) {
    return this.getChildElementBySelector(EntitySelectors.conversation)
      .getChildElementBySelector(EntitySelectors.entityName)
      .getElementLocator()
      .filter({ hasText: new RegExp(`^${RegexUtil.escapeRegexChars(name)}$`) });
  }

  public getConversationByName(name: string, index?: number) {
    return this.getChildElementBySelector(EntitySelectors.conversation)
      .getChildElementBySelector(EntitySelectors.entityName)
      .getElementLocatorByText(name, index);
  }

  public getConversationIcon(conversationName: string, index?: number) {
    return this.getConversationByName(conversationName, index)
      .locator('..')
      .locator(ReplaceConfirmationModalSelectors.iconContainer)
      .locator('img');
  }

  /**
   * Gets conversation arrow icon by conversation name
   */
  public getConversationArrowIcon(conversationName: string, index?: number) {
    return this.getConversationByName(conversationName, index)
      .locator('..')
      .locator('svg')
      .first();
  }

  public getFolderByName(folderName: string) {
    return this.getChildElementBySelector(FolderSelectors.folder)
      .getChildElementBySelector(FolderSelectors.folderName)
      .getElementLocator()
      .filter({
        hasText: `${folderName}`,
      });
  }

  public getFolderByExactName(name: string) {
    return this.getChildElementBySelector(FolderSelectors.folder)
      .getChildElementBySelector(FolderSelectors.folderName)
      .getElementLocator()
      .filter({ hasText: new RegExp(`^${RegexUtil.escapeRegexChars(name)}$`) });
  }

  /**
   * Gets folder arrow icon (expand/collapse indicator)
   * The arrow SVG is the first SVG element within the folder container
   */
  public getFolderArrowIcon(folderName: string) {
    // Get the folder container that contains this folder name
    const folderContainer = this.getChildElementBySelector(
      FolderSelectors.folder,
    )
      .getElementLocator()
      .filter({
        hasText: new RegExp(`^${RegexUtil.escapeRegexChars(folderName)}$`),
      });

    // The arrow icon is the first SVG within the folder container
    return folderContainer.locator('svg').first();
  }

  /**
   * Clicks on a folder to toggle its expanded/collapsed state
   */
  public async expandCollapseFolder(folderName: string) {
    const folderElement = this.getFolderByExactName(folderName);
    await folderElement.click();
  }
}
