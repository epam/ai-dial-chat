import {
  ChatBarSelectors,
  ChatSelectors,
  PromptBarSelectors,
  SideBarSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { ExpectedConstants } from '@/e2e/src/testData';
import { Styles } from '@/e2e/src/ui/domData';
import { FolderPrompts } from '@/e2e/src/ui/webElements/folderPrompts';
import { Prompts } from '@/e2e/src/ui/webElements/prompts';
import { Page } from '@playwright/test';

export class PromptBar extends BaseElement {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }

  private prompts!: Prompts;
  private folderPrompts!: FolderPrompts;
  public searchPrompt = this.getElementByPlaceholder('Search prompt...');
  public noResultFoundIcon = this.getChildElementBySelector(
    ChatSelectors.noResultFound,
  );
  public exportButton = new BaseElement(
    this.page,
    ChatBarSelectors.exportPrompts,
  );
  public importButton = this.getChildElementBySelector(SideBarSelectors.import);
  public draggableArea = this.getChildElementBySelector(
    SideBarSelectors.draggableArea,
  );

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

  public async hoverOverNewPrompt() {
    await this.newPromptButton.waitForState();
    await this.newPromptButton.hoverOver();
  }

  public async createNewPrompt() {
    await this.newPromptButton.waitForState();
    await this.newPromptButton.click();
  }

  public async getNewPromptBackgroundColor() {
    const backgroundColor = await this.newPromptButton.getComputedStyleProperty(
      Styles.backgroundColor,
    );
    backgroundColor[0] = backgroundColor[0].replace(
      ExpectedConstants.backgroundColorPattern,
      '$1)',
    );
    return backgroundColor[0];
  }

  public async getNewPromptCursor() {
    return this.newPromptButton.getComputedStyleProperty(Styles.cursor);
  }

  public async deleteAllPrompts() {
    await this.deleteAllPromptsButton.click();
  }

  public async dropPromptFromFolder(folderName: string, promptName: string) {
    const folderPrompt = await this.getFolderPrompts().getFolderPrompt(
      folderName,
      promptName,
    );
    await folderPrompt.hover();
    await this.page.mouse.down();
    const draggableBounding = await this.draggableArea.getElementBoundingBox();
    await this.page.mouse.move(
      draggableBounding!.x + draggableBounding!.width / 2,
      draggableBounding!.y + draggableBounding!.height / 2,
    );
    await this.page.mouse.up();
  }
}
