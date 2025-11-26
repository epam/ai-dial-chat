import { ImportResolutionOption } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
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

  /** Returns the import resolution dropdown for a specific conversation */
  public getConversationDropdownByName(conversationName: string) {
    return this.getConversationRowByName(conversationName).locator(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  /** Returns conversation row element by name */
  private getConversationRowByName(conversationName: string) {
    return this.getChildElementBySelector(EntitySelectors.conversation)
      .getElementLocator()
      .filter({
        has: this.page.locator(EntitySelectors.entityName).filter({
          hasText: conversationName,
        }),
      });
  }

  /** Returns the "All items" dropdown element */
  public getAllItemsDropdown() {
    return this.allItemsLine.getChildElementBySelector(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  /** Selects an import resolution option from the dropdown menu */
  private async selectDropdownOption(option: ImportResolutionOption) {
    const menuItem = this.page
      .locator(ReplaceConfirmationModalSelectors.menuItem)
      .filter({ hasText: option });
    await menuItem.click();
  }

  /** Sets import resolution option for all items */
  public async setAllItemsOption(option: ImportResolutionOption) {
    await this.getAllItemsDropdown().click();
    await this.selectDropdownOption(option);
  }

  /** Sets import resolution option for a specific conversation */
  public async setConversationOption(
    conversationName: string,
    option: ImportResolutionOption,
  ) {
    await this.getConversationDropdownByName(conversationName).click();
    await this.selectDropdownOption(option);
  }

  /** Clicks Continue button and waits for import completion */
  public async clickContinue({
    isHttpMethodTriggered = true,
    expectedPostRequests = 1,
  }: {
    isHttpMethodTriggered?: boolean;
    expectedPostRequests?: number;
  } = {}) {
    if (isHttpMethodTriggered) {
      const responsePromises: Promise<unknown>[] = [];
      for (let i = 0; i < expectedPostRequests; i++) {
        responsePromises.push(
          this.page.waitForResponse((r) => r.request().method() === 'POST'),
        );
      }
      await this.continueButton.click();
      await Promise.all(responsePromises);
    } else {
      await this.continueButton.click();
    }
  }

  /** Returns conversation element by exact name match */
  public getConversationByExactName(name: string) {
    return this.getChildElementBySelector(EntitySelectors.conversation)
      .getChildElementBySelector(EntitySelectors.entityName)
      .getElementLocator()
      .filter({ hasText: new RegExp(`^${RegexUtil.escapeRegexChars(name)}$`) });
  }

  /** Returns conversation element by name (partial match) */
  public getConversationByName(name: string, index?: number) {
    return this.getChildElementBySelector(EntitySelectors.conversation)
      .getChildElementBySelector(EntitySelectors.entityName)
      .getElementLocatorByText(name, index);
  }

  /** Returns the icon element for a conversation */
  public getConversationIcon(conversationName: string, index?: number) {
    return this.getConversationByName(conversationName, index)
      .locator('..')
      .locator(ReplaceConfirmationModalSelectors.iconContainer)
      .locator(Tags.img);
  }

  /** Returns the expand/collapse arrow icon for a conversation */
  public getConversationArrowIcon(conversationName: string, index?: number) {
    return this.getConversationByName(conversationName, index)
      .locator('..')
      .locator(Tags.svg)
      .first();
  }

  /** Returns folder element by name (partial match) */
  public getFolderByName(folderName: string) {
    return this.getChildElementBySelector(FolderSelectors.folder)
      .getChildElementBySelector(FolderSelectors.folderName)
      .getElementLocator()
      .filter({
        hasText: `${folderName}`,
      });
  }

  /** Returns folder element by exact name match */
  public getFolderByExactName(name: string) {
    return this.getChildElementBySelector(FolderSelectors.folder)
      .getChildElementBySelector(FolderSelectors.folderName)
      .getElementLocator()
      .filter({ hasText: new RegExp(`^${RegexUtil.escapeRegexChars(name)}$`) });
  }

  /** Returns the expand/collapse arrow icon for a folder */
  public getFolderArrowIcon(folderName: string) {
    const folderContainer = this.getChildElementBySelector(
      FolderSelectors.folder,
    )
      .getElementLocator()
      .filter({
        hasText: new RegExp(`^${RegexUtil.escapeRegexChars(folderName)}$`),
      });

    return folderContainer.locator(Tags.svg).first();
  }

  /** Toggles folder expand/collapse state */
  public async expandCollapseFolder(folderName: string) {
    const folderElement = this.getFolderByExactName(folderName);
    await folderElement.click();
  }
}
