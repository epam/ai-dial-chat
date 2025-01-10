import { PromptBarSelectors, SideBarSelectors } from '../selectors';

import { Styles, removeAlpha } from '@/src/ui/domData';
import {
  ApproveRequiredPrompts,
  FolderPrompts,
  PromptBarSection,
  PromptsTree,
  SharedWithMePromptsTree,
} from '@/src/ui/webElements/entityTree';
import { OrganizationPromptsTree } from '@/src/ui/webElements/entityTree/sidebar/organizationPromptsTree';
import { SideBar } from '@/src/ui/webElements/sideBar';
import { Locator, Page } from '@playwright/test';

export class PromptBar extends SideBar {
  constructor(page: Page, parentLocator: Locator) {
    super(page, SideBarSelectors.promptBar, parentLocator);
  }

  private promptsTree!: PromptsTree;
  private sharedWithMePromptsTree!: SharedWithMePromptsTree;
  private approveRequiredPrompts!: ApproveRequiredPrompts;
  private organizationPrompts!: OrganizationPromptsTree;

  private pinnedFolderPrompts!: FolderPrompts;
  private sharedFolderPrompts!: FolderPrompts;
  private organizationFolderPrompts!: FolderPrompts;
  private approveRequiredFolderPrompts!: FolderPrompts;

  getApproveRequiredPrompts(): ApproveRequiredPrompts {
    if (!this.approveRequiredPrompts) {
      this.approveRequiredPrompts = new ApproveRequiredPrompts(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.approveRequiredPrompts;
  }

  getPromptsTree(): PromptsTree {
    if (!this.promptsTree) {
      this.promptsTree = new PromptsTree(this.page, this.rootLocator);
    }
    return this.promptsTree;
  }

  getOrganizationPromptsTree(): OrganizationPromptsTree {
    if (!this.organizationPrompts) {
      this.organizationPrompts = new OrganizationPromptsTree(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.organizationPrompts;
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

  getSharedFolderPrompts(): FolderPrompts {
    if (!this.sharedFolderPrompts) {
      this.sharedFolderPrompts = new FolderPrompts(
        this.page,
        this.getElementLocator(),
        PromptBarSection.SharedWithMe,
      );
    }
    return this.sharedFolderPrompts;
  }

  getPinnedFolderPrompts(): FolderPrompts {
    if (!this.pinnedFolderPrompts) {
      this.pinnedFolderPrompts = new FolderPrompts(
        this.page,
        this.getElementLocator(),
        PromptBarSection.PinnedPrompts,
      );
    }
    return this.pinnedFolderPrompts;
  }

  getOrganizationFolderPrompts(): FolderPrompts {
    if (!this.organizationFolderPrompts) {
      this.organizationFolderPrompts = new FolderPrompts(
        this.page,
        this.getElementLocator(),
        PromptBarSection.Organization,
      );
    }
    return this.organizationFolderPrompts;
  }

  getApproveRequiredFolderPrompts(): FolderPrompts {
    if (!this.approveRequiredFolderPrompts) {
      this.approveRequiredFolderPrompts = new FolderPrompts(
        this.page,
        this.getElementLocator(),
        PromptBarSection.ApproveRequired,
      );
    }
    return this.approveRequiredFolderPrompts;
  }

  public async dragAndDropPromptFromFolder(
    folderName: string,
    promptName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderPrompt = this.getPinnedFolderPrompts().getFolderEntity(
      folderName,
      promptName,
    );
    await this.dragAndDropEntityFromFolder(folderPrompt, {
      isHttpMethodTriggered,
    });
  }

  public async dragPromptToFolder(folderName: string, promptName: string) {
    const folder = this.getPinnedFolderPrompts().getFolderByName(folderName);
    const prompt = this.getPromptsTree().getEntityByName(promptName);
    await this.dragEntityToFolder(prompt, folder);
  }

  public async dragAndDropPromptToFolderPrompt(
    folderName: string,
    folderPromptName: string,
    promptName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderPrompt = this.getPinnedFolderPrompts().getFolderEntity(
      folderName,
      folderPromptName,
    );
    const prompt = this.getPromptsTree().getEntityByName(promptName);
    await this.dragAndDropEntityToFolder(prompt, folderPrompt, {
      isHttpMethodTriggered,
    });
  }

  public async dragAndDropFolderToFolder(
    folderNameToMove: string,
    folderNameToMoveTo: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderPrompts = this.getPinnedFolderPrompts();
    const folderToMove = folderPrompts.getFolderByName(folderNameToMove);
    const folderToMoveTo = folderPrompts.getFolderByName(folderNameToMoveTo);
    await this.dragAndDropEntityToFolder(folderToMove, folderToMoveTo, {
      isHttpMethodTriggered,
    });
  }
}
