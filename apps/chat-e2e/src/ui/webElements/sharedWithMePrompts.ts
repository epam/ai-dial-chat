import { PromptBarSelectors } from '../selectors';

import { Styles } from '@/src/ui/domData';
import { SideBarEntities } from '@/src/ui/webElements/sideBarEntities';
import { Page } from '@playwright/test';

export class SharedWithMePrompts extends SideBarEntities {
  constructor(page: Page) {
    super(
      page,
      PromptBarSelectors.sharedWithMePrompts(),
      PromptBarSelectors.prompt,
    );
  }

  public async getSharedPromptBackgroundColor(name: string, index?: number) {
    const backgroundColor = await this.createElementFromLocator(
      this.getEntityByName(name, index),
    ).getComputedStyleProperty(Styles.backgroundColor);
    return backgroundColor[0];
  }
}
