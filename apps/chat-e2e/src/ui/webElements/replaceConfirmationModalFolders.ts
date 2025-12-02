import { ImportResolutionOption } from '@/src/testData';
import { ReplaceConfirmationModalSelectors } from '@/src/ui/selectors/dialogSelectors';
import { EntitySelectors } from '@/src/ui/selectors/entitySelectors';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { Locator, Page } from '@playwright/test';

export class ReplaceConfirmationModalFolders extends Folders {
  private conversationDropdownMenu!: DropdownButtonMenu;

  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ReplaceConfirmationModalSelectors.mainFolderTree,
      EntitySelectors.conversation,
    );
  }

  private getConversationDropdownMenu(): DropdownButtonMenu {
    if (!this.conversationDropdownMenu) {
      this.conversationDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.conversationDropdownMenu;
  }

  /**
   * Gets the dropdown element for a conversation within a specific folder.
   * @param folderName - Name of the folder containing the conversation
   * @param conversationName - Name of the conversation
   * @returns Locator for the conversation's dropdown trigger
   */
  public getConversationDropdownByName(
    folderName: string,
    conversationName: string,
  ) {
    return this.getFolderEntity(folderName, conversationName).locator(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  /**
   * Sets the import resolution option for a conversation within a specific folder.
   * @param folderName - Name of the folder containing the conversation
   * @param conversationName - Name of the conversation
   * @param option - Import resolution option (Replace, Postfix, or Ignore)
   */
  public async setConversationOption(
    folderName: string,
    conversationName: string,
    option: ImportResolutionOption,
  ) {
    await this.getConversationDropdownByName(
      folderName,
      conversationName,
    ).click();
    await this.getDropdownMenu().selectMenuOption(option, {
      isHttpMethodTriggered: false,
    });
  }
}
