import { ChatBarSelectors, SideBarSelectors } from '../selectors';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { ConfirmationDialog } from '@/src/ui/webElements/confirmationDialog';
import { Folders } from '@/src/ui/webElements/folders';
import { Input } from '@/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class FolderConversations extends Folders {
  constructor(page: Page) {
    super(page, ChatBarSelectors.chatFolders, ChatBarSelectors.conversation);
  }

  private confirmationDialog!: ConfirmationDialog;

  getConfirmationDialog(): ConfirmationDialog {
    if (!this.confirmationDialog) {
      this.confirmationDialog = new ConfirmationDialog(this.page);
    }
    return this.confirmationDialog;
  }

  public async deleteConversation() {
    const confirmationDialog = this.getConfirmationDialog();
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await confirmationDialog.confirm();
      return respPromise;
    }
    await confirmationDialog.confirm();
  }
}
