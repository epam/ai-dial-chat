import { PromptBarSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { keys } from '@/e2e/src/ui/keyboard';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { Input } from '@/e2e/src/ui/webElements/input';
import { Page } from '@playwright/test';

export class Prompts extends BaseElement {
  constructor(page: Page) {
    super(page, PromptBarSelectors.prompts);
  }
  public promptDotsMenu = (name: string, index?: number) => {
    return this.getPromptByName(name, index).locator(SideBarSelectors.dotsMenu);
  };

  private promptInput!: Input;

  getPromptInput(name: string): Input {
    if (!this.promptInput) {
      this.promptInput = new Input(
        this.page,
        `${PromptBarSelectors.prompt} >> ${SideBarSelectors.renameInput(name)}`,
      );
    }
    return this.promptInput;
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public getPromptByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      PromptBarSelectors.prompt,
    ).getElementLocatorByText(name, index);
  }

  public async selectPrompt(name: string, index?: number) {
    await this.getPromptByName(name, index).click();
  }

  public async openPromptDropdownMenu(name: string, index?: number) {
    const prompt = this.getPromptByName(name, index);
    await prompt.hover();
    await this.promptDotsMenu(name, index).click();
    await this.getDropdownMenu().waitForState();
  }

  public async editPromptNameWithTick(name: string, newName: string) {
    const input = await this.openEditPromptNameMode(name, newName);
    await input.clickTickButton();
  }

  public async editConversationNameWithEnter(name: string, newName: string) {
    await this.openEditPromptNameMode(name, newName);
    await this.page.keyboard.press(keys.enter);
  }

  public async openEditPromptNameMode(name: string, newName: string) {
    const input = await this.getPromptInput(name);
    await input.editValue(newName);
    return input;
  }
}
