import { PromptBarSelectors, SideBarSelectors } from '../selectors';

import { Styles, removeAlpha } from '@/src/ui/domData';
import {
  FolderPrompts,
  PromptsTree,
  SharedFolderPrompts,
  SharedWithMePromptsTree,
} from '@/src/ui/webElements/entityTree';
import { SideBar } from '@/src/ui/webElements/sideBar';
import { Page } from '@playwright/test';

export class PromptBar extends SideBar {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }

  private promptsTree!: PromptsTree;
  private folderPrompts!: FolderPrompts;
  private sharedWithMePromptsTree!: SharedWithMePromptsTree;
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

  getPromptsTree(): PromptsTree {
    if (!this.promptsTree) {
      this.promptsTree = new PromptsTree(this.page, this.rootLocator);
    }
    return this.promptsTree;
  }

  getSharedWithMePromptsTree(): SharedWithMePromptsTree {
    if (!this.sharedWithMePromptsTree) {
      this.sharedWithMePromptsTree = new SharedWithMePromptsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.sharedWithMePromptsTree;
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

  public newEntityButton = this.getChildElementBySelector(
    PromptBarSelectors.newEntity,
  );

  public async createNewPrompt() {
    await this.newEntityButton.waitForState();
    await this.newEntityButton.click();
  }

  public async hoverOverNewEntity() {
    await this.newEntityButton.waitForState();
    await this.newEntityButton.hoverOver();
  }

  public async getNewEntityBackgroundColor() {
    const backgroundColor = await this.newEntityButton.getComputedStyleProperty(
      Styles.backgroundColor,
    );
    return removeAlpha(backgroundColor[0]);
  }

  public async getNewEntityCursor() {
    return this.newEntityButton.getComputedStyleProperty(Styles.cursor);
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
    const prompt = this.getPromptsTree().getEntityByName(promptName);
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
    const prompt = this.getPromptsTree().getEntityByName(promptName);
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
