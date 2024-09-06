import { EntitySelectors, PromptBarSelectors } from '../../../selectors';

import { SideBarEntities } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntities';
import { Locator, Page } from '@playwright/test';

export class Prompts extends SideBarEntities {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.prompts,
      EntitySelectors.prompt,
    );
  }
}
