import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { ChatMessages } from './chatMessages';
import { ConversationSettings } from './conversationSettings';
import { SendMessage } from './sendMessage';

import { Page } from '@playwright/test';

export class Chat extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chat);
  }

  private conversationSettings!: ConversationSettings;
  private sendMessage!: SendMessage;
  private chatMessages!: ChatMessages;
  private regenerate = new BaseElement(this.page, ChatSelectors.regenerate);

  getConversationSettings(): ConversationSettings {
    if (!this.conversationSettings) {
      this.conversationSettings = new ConversationSettings(this.page);
    }
    return this.conversationSettings;
  }

  getSendMessage(): SendMessage {
    if (!this.sendMessage) {
      this.sendMessage = new SendMessage(this.page);
    }
    return this.sendMessage;
  }

  getChatMessages(): ChatMessages {
    if (!this.chatMessages) {
      this.chatMessages = new ChatMessages(this.page);
    }
    return this.chatMessages;
  }

  public async sendRequest(message: string) {
    await this.getSendMessage().send(message);
    await this.getChatMessages().waitForResponseReceived();
  }

  public async regenerateResponse() {
    await this.regenerate.click();
    await this.getChatMessages().waitForResponseReceived();
  }
}
