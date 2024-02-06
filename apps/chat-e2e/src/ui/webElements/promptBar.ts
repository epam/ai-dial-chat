import { SideBarSelectors } from '../selectors';

import { FolderPrompts } from '@/src/ui/webElements/folderPrompts';
import { Prompts } from '@/src/ui/webElements/prompts';
import { SideBar } from '@/src/ui/webElements/sideBar';
import { Page } from '@playwright/test';

export class PromptBar extends SideBar {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }

  private prompts!: Prompts;
  private folderPrompts!: FolderPrompts;

  getFolderPrompts(): FolderPrompts {
    if (!this.folderPrompts) {
      this.folderPrompts = new FolderPrompts(this.page);
    }
    return this.folderPrompts;
  }

  getPrompts(): Prompts {
    if (!this.prompts) {
      this.prompts = new Prompts(this.page);
    }
    return this.prompts;
  }

  public async createNewPrompt() {
    await this.newEntityButton.waitForState();
    await this.newEntityButton.click();
  }
}
