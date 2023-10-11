import { ChatBarSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { Conversations } from './conversations';

import { API, Import } from '@/e2e/src/testData';
import { FolderConversations } from '@/e2e/src/ui/webElements/folderConversations';
import { Page } from '@playwright/test';
import path from 'path';

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

  public async importConversation(filename: string, isExported = true) {
    const directory = isExported ? '' : Import.importPath;
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.importButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(directory, filename));
  }

  public async exportConversation() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportButton.click();
    const download = await downloadPromise;
    const filePath = path.join(Import.exportPath, download.suggestedFilename());
    await download.saveAs(filePath);
    return filePath;
  }
}
