import { SideBarSelectors } from '../selectors';

import {
  FolderPrompts,
  Prompts,
  SharedFolderPrompts,
  SharedWithMePrompts,
} from '@/src/ui/webElements/entityTree';
import { SideBar } from '@/src/ui/webElements/sideBar';
import { Page } from '@playwright/test';

export class PromptBar extends SideBar {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }

  private prompts!: Prompts;
  private folderPrompts!: FolderPrompts;
  private sharedWithMePrompts!: SharedWithMePrompts;
  private sharedFolderPrompts!: SharedFolderPrompts;

  getFolderPrompts(): FolderPrompts {
    if (!this.folderPrompts) {
      this.folderPrompts = new FolderPrompts(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.folderPrompts;
  }

  getPrompts(): Prompts {
    if (!this.prompts) {
      this.prompts = new Prompts(this.page, this.rootLocator);
    }
    return this.prompts;
  }

  getSharedWithMePrompts(): SharedWithMePrompts {
    if (!this.sharedWithMePrompts) {
      this.sharedWithMePrompts = new SharedWithMePrompts(
        this.page,
        this.rootLocator,
      );
    }
    return this.sharedWithMePrompts;
  }

  getSharedFolderPrompts(): SharedFolderPrompts {
    if (!this.sharedFolderPrompts) {
      this.sharedFolderPrompts = new SharedFolderPrompts(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.sharedFolderPrompts;
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
    const folderPrompt = this.getFolderPrompts().getFolderEntity(
      folderName,
      promptName,
    );
    await this.dragAndDropEntityFromFolder(folderPrompt, {
      isHttpMethodTriggered,
    });
  }

  public async drugPromptToFolder(folderName: string, promptName: string) {
    const folder = this.getFolderPrompts().getFolderByName(folderName);
    const prompt = this.getPrompts().getEntityByName(promptName);
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
    const prompt = this.getPrompts().getEntityByName(promptName);
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
