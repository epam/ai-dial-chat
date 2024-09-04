import { PromptBarSelectors } from '../selectors';

import { SideBarEntities } from '@/src/ui/webElements/sideBarEntities';
import { Page } from '@playwright/test';

export class Prompts extends SideBarEntities {
  constructor(page: Page) {
    super(page, PromptBarSelectors.prompts, PromptBarSelectors.prompt);
  }

  public getPromptName(name: string, index?: number) {
    return this.getEntityName(PromptBarSelectors.promptName, name, index);
  }
}
