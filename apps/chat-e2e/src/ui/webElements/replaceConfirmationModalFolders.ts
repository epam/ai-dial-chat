import { ImportResolutionOption } from '@/src/testData';
import { FolderSelectors } from '@/src/ui/selectors';
import { ReplaceConfirmationModalSelectors } from '@/src/ui/selectors/dialogSelectors';
import { EntitySelectors } from '@/src/ui/selectors/entitySelectors';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { Locator, Page } from '@playwright/test';

export class ReplaceConfirmationModalFolders extends Folders {
  private dropdownMenu!: DropdownButtonMenu;

  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      FolderSelectors.folder,
      EntitySelectors.conversation,
    );
  }

  getFolderByName(name: string, index?: number) {
    return this.getElementLocatorByText(name, index);
  }

  private getDropdownMenu(): DropdownButtonMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public getConversationDropdownByName(conversationName: string) {
    return this.getConversationRowByName(conversationName).locator(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  private getConversationRowByName(conversationName: string) {
    return this.getChildElementBySelector(FolderSelectors.folder)
      .locator(EntitySelectors.conversation)
      .filter({
        has: this.page.locator(EntitySelectors.entityName).filter({
          hasText: conversationName,
        }),
      });
  }

  public async setConversationOption(
    conversationName: string,
    option: ImportResolutionOption,
  ) {
    await this.getConversationDropdownByName(conversationName).click();
    await this.getDropdownMenu().selectMenuOption(option, {
      isHttpMethodTriggered: false,
    });
  }
}
