import { ChatBarSelectors } from '../selectors';

import { Folders } from '@/src/ui/webElements/folders';
import { Page } from '@playwright/test';

export class FolderConversations extends Folders {
  constructor(page: Page) {
    super(page, ChatBarSelectors.chatFolders, ChatBarSelectors.conversation);
  }
}
