import { EntityTreeSelectors, PromptBarSelectors } from '../../../selectors';

import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { Locator, Page } from '@playwright/test';

export class FolderPrompts extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.pinnedChats(),
      EntityTreeSelectors.prompt,
    );
  }
}
