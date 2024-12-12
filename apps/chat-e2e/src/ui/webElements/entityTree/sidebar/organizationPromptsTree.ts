import { EntitySelectors, PromptBarSelectors } from '../../../selectors';

import { BaseSideBarConversationTree } from '@/src/ui/webElements/entityTree/sidebar/baseSideBarConversationTree';
import { Locator, Page } from '@playwright/test';

export class OrganizationPromptsTree extends BaseSideBarConversationTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.organizationPrompts(),
      EntitySelectors.prompt,
    );
  }
}
