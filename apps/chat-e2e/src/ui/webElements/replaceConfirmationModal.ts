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
}
