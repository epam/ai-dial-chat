import { ImportResolutionOption } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { FolderSelectors } from '@/src/ui/selectors';
import { ReplaceConfirmationModalSelectors } from '@/src/ui/selectors/dialogSelectors';
import { EntitySelectors } from '@/src/ui/selectors/entitySelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { EntitiesTree } from '@/src/ui/webElements/entityTree/entitiesTree';
import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { RegexUtil } from '@/src/utils';
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

  private folders!: Folders;

  public getFolders(): Folders {
    if (!this.folders) {
      this.folders = new Folders(
        this.page,
        this.getElementLocator(),
        FolderSelectors.folder,
        EntitySelectors.conversation,
      );
    }
    return this.folders;
  }

  private conversations!: EntitiesTree;

  public getConversations(): EntitiesTree {
    if (!this.conversations) {
      this.conversations = new EntitiesTree(
        this.page,
        this.getElementLocator(),
        ReplaceConfirmationModalSelectors.modalContainer,
        EntitySelectors.conversation,
      );
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

  /** Sets import resolution option for all items */
  public async setAllItemsOption(option: ImportResolutionOption) {
    await this.getAllItemsDropdown().click();
    await this.getDropdownMenu().selectMenuOption(option, {
      isHttpMethodTriggered: false,
    });
  }

  /** Sets import resolution option for a specific conversation */
  public async setConversationOption(
    conversationName: string,
    option: ImportResolutionOption,
  ) {
    await this.getConversationDropdownByName(conversationName).click();
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
