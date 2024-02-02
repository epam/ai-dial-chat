import { PromptBarSelectors } from '../selectors';

import { Input } from '@/src/ui/webElements/input';
import { SideBarEntities } from '@/src/ui/webElements/sideBarEntities';
import { Page } from '@playwright/test';

export class Prompts extends SideBarEntities {
  constructor(page: Page) {
    super(page, PromptBarSelectors.prompts, PromptBarSelectors.prompt);
  }

  getPromptInput(name: string): Input {
    return this.getEntityInput(this.entitySelector, name);
  }

  public getPromptByName(name: string, index?: number) {
    return this.getEntityByName(this.entitySelector, name, index);
  }

  public getPromptArrowIcon(name: string, index?: number) {
    return this.getEntityArrowIcon(this.entitySelector, name, index);
  }

  public getPromptArrowIconColor(name: string, index?: number) {
    return this.getEntityArrowIconColor(this.entitySelector, name, index);
  }

  public async openPromptDropdownMenu(name: string, index?: number) {
    await this.openEntityDropdownMenu(this.entitySelector, name, index);
  }

  public async getPromptsCount() {
    return this.getChildElementBySelector(
      this.entitySelector,
    ).getElementsCount();
  }
}
