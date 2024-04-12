import { ChatBarSelectors, SideBarSelectors } from '../selectors';
import { Conversations } from './conversations';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { API } from '@/src/testData';
import { FolderConversations } from '@/src/ui/webElements/folderConversations';
import { SharedFolderConversations } from '@/src/ui/webElements/sharedFolderConversations';
import { SharedWithMeConversations } from '@/src/ui/webElements/sharedWithMeConversations';
import { SideBar } from '@/src/ui/webElements/sideBar';
import { Page } from '@playwright/test';

export class ChatBar extends SideBar {
  constructor(page: Page) {
    super(page, SideBarSelectors.chatBar);
  }

  private conversations!: Conversations;
  private sharedWithMeConversations!: SharedWithMeConversations;
  private folderConversations!: FolderConversations;
  private sharedFolderConversations!: SharedFolderConversations;
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

  getSharedWithMeConversations(): SharedWithMeConversations {
    if (!this.sharedWithMeConversations) {
      this.sharedWithMeConversations = new SharedWithMeConversations(this.page);
    }
    return this.sharedWithMeConversations;
  }

  getFolderConversations(): FolderConversations {
    if (!this.folderConversations) {
      this.folderConversations = new FolderConversations(this.page);
    }
    return this.folderConversations;
  }

  getSharedFolderConversations(): SharedFolderConversations {
    if (!this.sharedFolderConversations) {
      this.sharedFolderConversations = new SharedFolderConversations(this.page);
    }
    return this.sharedFolderConversations;
  }

  public async createNewConversation() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    let putResponsePromise;
    if (isApiStorageType) {
      putResponsePromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST',
      );
    }
    await this.newEntityButton.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
    if (isApiStorageType) {
      await putResponsePromise;
    }
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

  public async dragAndDropFolderToRootLevel(
    folderName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folder =
      await this.getFolderConversations().getFolderByName(folderName);
    await this.dragFolderToRoot(folder, { isHttpMethodTriggered });
  }
}
