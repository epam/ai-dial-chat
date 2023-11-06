import {
  ChatBarSelectors,
  PromptBarSelectors,
  SideBarSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { FolderPrompts } from '@/e2e/src/ui/webElements/folderPrompts';
import { Prompts } from '@/e2e/src/ui/webElements/prompts';
import { Page } from '@playwright/test';

export class PromptBar extends BaseElement {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }

  private prompts!: Prompts;
  private folderPrompts!: FolderPrompts;
  public exportButton = new BaseElement(
    this.page,
    ChatBarSelectors.exportPrompts,
  );
  public importButton = this.getChildElementBySelector(SideBarSelectors.import);

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

  public newFolderButton = new BaseElement(
    this.page,
    PromptBarSelectors.newFolder,
  );

  public newPromptButton = new BaseElement(
    this.page,
    PromptBarSelectors.newPromptButton,
  );

  public deleteAllPromptsButton = new BaseElement(
    this.page,
    PromptBarSelectors.deletePrompts,
  );

  public async createNewFolder() {
    await this.newFolderButton.click();
  }

  public async createNewPrompt() {
    await this.newPromptButton.waitForState();
    await this.newPromptButton.click();
  }

  public async deleteAllPrompts() {
    await this.deleteAllPromptsButton.click();
  }
}
