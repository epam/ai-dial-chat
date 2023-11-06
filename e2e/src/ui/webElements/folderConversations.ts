import { ChatBarSelectors, SideBarSelectors } from '../selectors';

import { Tags } from '@/e2e/src/ui/domData';
import { Folders } from '@/e2e/src/ui/webElements/folders';
import { Input } from '@/e2e/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class FolderConversations extends Folders {
  constructor(page: Page) {
    super(page, ChatBarSelectors.chatFolders);
  }

  private folderConversationInput!: Input;

  getFolderConversationInput(name: string): Input {
    if (!this.folderConversationInput) {
      this.folderConversationInput = new Input(
        this.page,
        `${SideBarSelectors.folder} >> ${
          ChatBarSelectors.conversation
        } >> ${SideBarSelectors.renameInput(name)}`,
      );
    }
    return this.folderConversationInput;
  }

  public folderConversationDotsMenu = (
    folderName: string,
    conversationName: string,
  ) => {
    return this.getFolderConversation(folderName, conversationName).locator(
      SideBarSelectors.dotsMenu,
    );
  };

  public getFolderConversations(name: string, index?: number) {
    return this.getFolderByName(name, index).locator(
      `~${Tags.div} ${ChatBarSelectors.conversation}`,
    );
  }

  public getFolderConversation(folderName: string, conversationName: string) {
    return this.getFolderConversations(folderName).filter({
      hasText: conversationName,
    });
  }

  public async isFolderConversationVisible(
    folderName: string,
    conversationName: string,
  ) {
    return this.getFolderConversation(folderName, conversationName).isVisible();
  }

  public async selectFolderConversation(
    folderName: string,
    conversationName: string,
  ) {
    return this.getFolderConversation(folderName, conversationName).click();
  }

  public async openFolderConversationDropdownMenu(
    folderName: string,
    conversationName: string,
  ) {
    const folderConversation = await this.getFolderConversation(
      folderName,
      conversationName,
    );
    await folderConversation.hover();
    await this.folderConversationDotsMenu(folderName, conversationName).click();
    await this.getDropdownMenu().waitForState();
  }

  public async dropConversationFromFolder(
    folderName: string,
    conversationName: string,
  ) {
    const folderConversation = await this.getFolderConversation(
      folderName,
      conversationName,
    );
    await folderConversation.waitFor();
    await folderConversation.hover();
    await this.page.mouse.down();
    const foldersBounding = await this.getElementBoundingBox();
    await this.page.mouse.move(
      foldersBounding!.x,
      foldersBounding!.y + 1.5 * foldersBounding!.height,
    );
    await this.page.mouse.up();
  }
}
