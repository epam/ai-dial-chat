import { ChatBarSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { Conversation } from './conversation';

import { Page } from '@playwright/test';

export class ChatBar extends BaseElement {
  constructor(page: Page) {
    super(page, SideBarSelectors.chatBar);
  }

  private conversations!: Conversation;

  public newChatButton = new BaseElement(
    this.page,
    ChatBarSelectors.newChatButton,
  );

  getConversations(): Conversation {
    if (!this.conversations) {
      this.conversations = new Conversation(this.page);
    }
    return this.conversations;
  }

  public async createNewChat() {
    await this.newChatButton.click();
  }
}
