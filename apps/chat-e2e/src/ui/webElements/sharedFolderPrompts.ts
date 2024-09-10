import { PromptBarSelectors } from '../selectors';

import { Folders } from '@/src/ui/webElements/folders';
import { Locator, Page } from '@playwright/test';

export class SharedFolderPrompts extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.sharedWithMePrompts(),
      PromptBarSelectors.prompt,
    );
  }
}
