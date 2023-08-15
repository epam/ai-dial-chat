import { ChatBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { Input } from '@/e2e/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class FolderConversations extends BaseElement {
  constructor(page: Page) {
    super(page, ChatBarSelectors.chatFolders);
  }

  private folderInput!: Input;
  private folderConversationInput!: Input;

  getFolderInput(name: string): Input {
    if (!this.folderInput) {
      this.folderInput = new Input(
        this.page,
        `${ChatBarSelectors.chatFolder} >> ${ChatBarSelectors.renameInput(
          name,
        )}`,
      );
    }
    return this.folderInput;
  }

  getFolderConversationInput(name: string): Input {
    if (!this.folderConversationInput) {
      this.folderConversationInput = new Input(
        this.page,
        `${ChatBarSelectors.chatFolder} >> ${
          ChatBarSelectors.conversation
        } >> ${ChatBarSelectors.renameInput(name)}`,
      );
    }
    return this.folderConversationInput;
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public folderDotsMenu = (name: string, index?: number) => {
    return this.getFolderByName(name, index).locator(ChatBarSelectors.dotsMenu);
  };

  public folderConversationDotsMenu = (
    folderName: string,
    conversationName: string,
  ) => {
    return this.getFolderConversation(folderName, conversationName).locator(
      ChatBarSelectors.dotsMenu,
    );
  };

  public getFolderByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      ChatBarSelectors.chatFolder,
    ).getElementLocatorByText(name, index);
  }

  public getFolderConversations(name: string, index?: number) {
    return this.getFolderByName(name, index).locator(
      `~${Tags.div} > ${ChatBarSelectors.conversation}`,
    );
  }

  public getFolderConversation(folderName: string, conversationName: string) {
    return this.getFolderConversations(folderName).filter({
      hasText: conversationName,
    });
  }

  public async openFolderDropdownMenu(name: string, index?: number) {
    const folderToEdit = this.getFolderByName(name, index);
    await folderToEdit.hover();
    await this.folderDotsMenu(name, index).click();
    await this.getDropdownMenu().waitForState();
  }

  public async editFolderNameWithEnter(name: string, newName: string) {
    await this.getFolderInput(name).editValue(newName);
    await this.page.keyboard.press(keys.enter);
  }

  public async editFolderNameWithTick(name: string, newName: string) {
    const folderInput = await this.getFolderInput(name);
    await folderInput.editValue(newName);
    await folderInput.clickTickButton();
  }

  public async expandCollapseFolder(name: string, index?: number) {
    await this.getFolderByName(name, index).click();
  }

  public async isFolderConversationVisible(
    folderName: string,
    conversationName: string,
  ) {
    return this.getFolderConversation(folderName, conversationName).isVisible();
  }

  public async openFolderConversationDropdownMenu(
    folderName: string,
    conversationName: string,
  ) {
    const folderConversation = await this.getFolderConversation(
      folderName,
      conversationName,
    );
    await folderConversation.hover();
    await this.folderConversationDotsMenu(folderName, conversationName).click();
    await this.getDropdownMenu().waitForState();
  }
}
