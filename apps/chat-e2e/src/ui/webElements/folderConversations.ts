import { ChatBarSelectors, SideBarSelectors } from '../selectors';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { Folders } from '@/src/ui/webElements/folders';
import { Input } from '@/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class FolderConversations extends Folders {
  constructor(page: Page) {
    super(page, ChatBarSelectors.chatFolders, ChatBarSelectors.conversation);
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

  public async deleteConversation(name: string) {
    const folderConversation = this.getFolderConversationInput(name);
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await folderConversation.clickTickButton();
      return respPromise;
    }
    await folderConversation.clickTickButton();
  }
}
