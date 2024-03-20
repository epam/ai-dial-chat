import { ChatBarSelectors } from '../selectors';

import { BaseConversation } from '@/src/ui/webElements/baseConversation';
import { Page } from '@playwright/test';

export class SharedWithMeConversations extends BaseConversation {
  constructor(page: Page) {
    super(
      page,
      ChatBarSelectors.sharedWithMeChats(),
      ChatBarSelectors.conversation,
    );
  }
}
