import { ChatBarSelectors, SideBarSelectors } from '../selectors';
import { Conversations } from './conversations';

import { API } from '@/e2e/src/testData';
import { FolderConversations } from '@/e2e/src/ui/webElements/folderConversations';
import { SideBar } from '@/e2e/src/ui/webElements/sideBar';
import { Page } from '@playwright/test';

export class ChatBar extends SideBar {
  constructor(page: Page) {
    super(page, SideBarSelectors.chatBar);
  }

  private conversations!: Conversations;
  private folderConversations!: FolderConversations;
  public compareButton = this.getChildElementBySelector(
    ChatBarSelectors.compare,
  );
  public attachments = this.getChildElementBySelector(
    ChatBarSelectors.attachments,
  );
  public bottomDotsMenuIcon = this.bottomPanel.getChildElementBySelector(
    SideBarSelectors.dotsMenu,
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
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    await this.newEntityButton.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
  }

  public async openCompareMode() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    await this.compareButton.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
  }
}
