import { PromptBarSelectors } from '../selectors';

import { MenuOptions } from '@/src/testData';
import { SideBarEntities } from '@/src/ui/webElements/sideBarEntities';
import { Page } from '@playwright/test';

export class Prompts extends SideBarEntities {
  constructor(page: Page) {
    super(page, PromptBarSelectors.prompts, PromptBarSelectors.prompt);
  }

  public async duplicatePrompt() {
    const response = await this.selectEntityMenuOption(MenuOptions.duplicate, {
      triggeredHttpMethod: 'POST',
    });
    if (response !== undefined) {
      return response.request().postDataJSON();
    }
  }
}
