import { ChatBarSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { Conversations } from './conversations';

import { API } from '@/e2e/src/testData';
import { Styles } from '@/e2e/src/ui/domData';
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

  public compareButton = new BaseElement(this.page, ChatBarSelectors.compare);
  public importButton = this.getChildElementBySelector(SideBarSelectors.import);
  public exportButton = new BaseElement(
    this.page,
    ChatBarSelectors.exportConversations,
  );
  public draggableArea = this.getChildElementBySelector(
    SideBarSelectors.draggableArea,
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
    await this.newConversationButton.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
  }

  public async createNewFolder() {
    await this.newFolderButton.click();
  }

  public async deleteAllConversations() {
    await this.deleteAllConversationsButton.click();
  }

  public async openCompareMode() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    await this.compareButton.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
  }

  public async getDraggableAreaColor() {
    return this.draggableArea.getComputedStyleProperty(Styles.backgroundColor);
  }
}
