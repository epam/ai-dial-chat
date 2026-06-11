import { ImportResolutionOption } from '@/src/testData';
import { ReplaceConfirmationModalSelectors } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { ReplaceConfirmationModalConversations } from '@/src/ui/webElements/replaceConfirmationModalConversations';
import { ReplaceConfirmationModalFolders } from '@/src/ui/webElements/replaceConfirmationModalFolders';
import { Locator, Page } from '@playwright/test';

export class ReplaceConfirmationModal extends BaseElement {
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

  public title = this.getChildElementBySelector(
    ReplaceConfirmationModalSelectors.title,
  );

  public description = this.getChildElementBySelector(
    ReplaceConfirmationModalSelectors.description,
  );

  private folders!: ReplaceConfirmationModalFolders;

  public getFolders(): ReplaceConfirmationModalFolders {
    if (!this.folders) {
      this.folders = new ReplaceConfirmationModalFolders(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.folders;
  }

  private conversations!: ReplaceConfirmationModalConversations;

  public getConversations(): ReplaceConfirmationModalConversations {
    if (!this.conversations) {
      this.conversations = new ReplaceConfirmationModalConversations(this.page);
    }
    return this.conversations;
  }

  private dropdownMenu!: DropdownButtonMenu;

  private getDropdownMenu(): DropdownButtonMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.dropdownMenu;
  }

  /** Returns the "All items" dropdown element */
  public getAllItemsDropdown() {
    return this.allItemsLine.getChildElementBySelector(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  /** Sets import resolution option for all items */
  public async setAllItemsOption(option: ImportResolutionOption) {
    await this.getAllItemsDropdown().click();
    await this.getDropdownMenu().selectMenuOption(option, {
      isHttpMethodTriggered: false,
    });
  }

  /**
   * Clicks Continue button and waits for import completion.
   * @param expectedRequests - Optional map of partial request paths to HTTP methods.
   *                          Example: { '/conversations/chat1': 'POST', '/conversations/chat2': 'PUT' }
   *                          If not provided, the button is clicked without waiting for any requests.
   */
  public async confirmUploadDuplicates() {
    await this.waitForState({ state: 'visible' });
    await this.clickContinue();
  }

  public async clickContinue(expectedRequests?: Map<string, string>) {
    if (expectedRequests && expectedRequests.size > 0) {
      const responsePromises: Promise<unknown>[] = [];

      for (const [partialPath, method] of expectedRequests) {
        responsePromises.push(
          this.page.waitForResponse(
            (r) =>
              r.url().includes(partialPath) && r.request().method() === method,
          ),
        );
      }

      await this.continueButton.click();
      await Promise.all(responsePromises);
    } else {
      await this.continueButton.click();
    }
  }
}
