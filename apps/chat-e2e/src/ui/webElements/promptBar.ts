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

  public async dragAndDropPromptFromFolder(
    folderName: string,
    promptName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderPrompt = await this.getFolderPrompts().getFolderEntity(
      folderName,
      promptName,
    );
    await this.dragAndDropEntityFromFolder(folderPrompt, {
      isHttpMethodTriggered,
    });
  }

  public async drugPromptToFolder(folderName: string, promptName: string) {
    const folder = this.getFolderPrompts().getFolderByName(folderName);
    const prompt = this.getPrompts().getPromptByName(promptName);
    await this.dragEntityToFolder(prompt, folder);
  }

  public async drugAndDropPromptToFolderPrompt(
    folderName: string,
    folderPromptName: string,
    promptName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderPrompt = this.getFolderPrompts().getFolderEntity(
      folderName,
      folderPromptName,
    );
    const prompt = this.getPrompts().getPromptByName(promptName);
    await this.dragAndDropEntityToFolder(prompt, folderPrompt, {
      isHttpMethodTriggered,
    });
  }

  public async drugAndDropFolderToFolder(
    folderNameToMove: string,
    folderNameToMoveTo: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderPrompts = this.getFolderPrompts();
    const folderToMove = folderPrompts.getFolderByName(folderNameToMove);
    const folderToMoveTo = folderPrompts.getFolderByName(folderNameToMoveTo);
    await this.dragAndDropEntityToFolder(folderToMove, folderToMoveTo, {
      isHttpMethodTriggered,
    });
  }
}
