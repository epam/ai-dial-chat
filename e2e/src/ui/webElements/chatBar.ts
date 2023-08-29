import { ChatBarSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { Conversations } from './conversations';

import { FolderConversations } from '@/e2e/src/ui/webElements/folderConversations';
import { Page } from '@playwright/test';

export class ChatBar extends BaseElement {
  constructor(page: Page) {
    super(page, SideBarSelectors.chatBar);
  }

  private conversations!: Conversations;
  private folderConversations!: FolderConversations;

  public newConversationButton = new BaseElement(
    this.page,
    ChatBarSelectors.newConversationButton,
  );
  public newFolderButton = new BaseElement(
    this.page,
    ChatBarSelectors.newFolder,
  );

  public deleteAllConversationsButton = new BaseElement(
    this.page,
    ChatBarSelectors.deleteConversations,
  );

  getConversations(): Conversations {
    if (!this.conversations) {
      this.conversations = new Conversations(this.page);
    }
    return this.conversations;
  }

  getFolderConversations(): FolderConversations {
    if (!this.folderConversations) {
      this.folderConversations = new FolderConversations(this.page);
    }
    return this.folderConversations;
  }

  public async createNewConversation() {
    await this.newConversationButton.click();
  }

  public async createNewFolder() {
    await this.newFolderButton.click();
  }

  public async deleteAllConversations() {
    await this.deleteAllConversationsButton.click();
  }
}
