import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { ChatMessages } from './chatMessages';
import { ConversationSettings } from './conversationSettings';
import { Message } from './message';

import { Page } from '@playwright/test';

export class Chat extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chat);
  }

  private conversationSettings!: ConversationSettings;
  private message!: Message;
  private chatMessages!: ChatMessages;

  getConversationSettings(): ConversationSettings {
    if (!this.conversationSettings) {
      this.conversationSettings = new ConversationSettings(this.page);
    }
    return this.conversationSettings;
  }

  getMessage(): Message {
    if (!this.message) {
      this.message = new Message(this.page);
    }
    return this.message;
  }

  getChatMessages(): ChatMessages {
    if (!this.chatMessages) {
      this.chatMessages = new ChatMessages(this.page);
    }
    return this.chatMessages;
  }

  public async waitForResponseReceived() {
    await this.getChatMessages().loadingCursor.waitForState({
      state: 'detached',
    });
  }
}
