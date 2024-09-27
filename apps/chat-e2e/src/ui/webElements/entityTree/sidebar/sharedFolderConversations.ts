import { ChatBarSelectors, EntitySelectors } from '../../../selectors';

import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { Locator, Page } from '@playwright/test';

export class SharedFolderConversations extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.sharedWithMeChats(),
      EntitySelectors.conversation,
    );
  }
}
