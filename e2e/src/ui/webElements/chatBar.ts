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

  public newChatButton = new BaseElement(
    this.page,
    ChatBarSelectors.newChatButton,
  );
  public newFolderButton = new BaseElement(
    this.page,
    ChatBarSelectors.newFolder,
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

  public async createNewChat() {
    await this.newChatButton.click();
  }

  public async createNewFolder() {
    await this.newFolderButton.click();
  }
}
