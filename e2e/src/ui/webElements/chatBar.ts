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

  public async drugConversationFromFolder(
    folderName: string,
    conversationName: string,
  ) {
    const folderConversation = this.getFolderConversations().getFolderEntity(
      folderName,
      conversationName,
    );
    await this.dragEntityFromFolder(folderConversation);
  }

  public async drugConversationToFolder(
    folderName: string,
    conversationName: string,
  ) {
    const folder = this.getFolderConversations().getFolderByName(folderName);
    const conversation =
      this.getConversations().getConversationByName(conversationName);
    await this.dragEntityToFolder(conversation, folder);
  }

  public async drugAndDropConversationToFolderConversation(
    folderName: string,
    folderConversationName: string,
    conversationName: string,
  ) {
    const folderConversation = this.getFolderConversations().getFolderEntity(
      folderName,
      folderConversationName,
    );
    const conversation =
      this.getConversations().getConversationByName(conversationName);
    await this.dragAndDropEntityToFolder(conversation, folderConversation);
  }
}
