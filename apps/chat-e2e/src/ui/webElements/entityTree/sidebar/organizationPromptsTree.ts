import { EntitySelectors, PromptBarSelectors } from '../../../selectors';

import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class OrganizationPromptsTree extends SideBarEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.organizationPrompts(),
      EntitySelectors.prompt,
    );
  }
}
