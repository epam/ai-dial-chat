import { EntitySelectors, PromptBarSelectors } from '../../../selectors';

import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class PromptsTree extends SideBarEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.prompts,
      EntitySelectors.prompt,
    );
  }
}
