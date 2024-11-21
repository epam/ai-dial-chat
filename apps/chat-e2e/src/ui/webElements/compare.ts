import { BaseElement } from './baseElement';
import { ConversationSettings } from './conversationSettings';

import { CompareSelectors } from '@/src/ui/selectors';
import { ChatHeader } from '@/src/ui/webElements/chatHeader';
import { ChatMessages } from '@/src/ui/webElements/chatMessages';
import { ConversationToCompare } from '@/src/ui/webElements/conversationToCompare';
import { Page } from '@playwright/test';

export class Compare extends BaseElement {
  constructor(page: Page) {
    super(page, CompareSelectors.compareMode);
  }
  private leftConversationSettings!: ConversationSettings;
  private rightConversationSettings!: ConversationSettings;
  private chatMessages!: ChatMessages;
  private conversationToCompare!: ConversationToCompare;
  private rightChatHeader!: ChatHeader;
  private leftChatHeader!: ChatHeader;

  getLeftConversationSettings(): ConversationSettings {
    if (!this.leftConversationSettings) {
      this.leftConversationSettings = new ConversationSettings(this.page);
    }
    return this.leftConversationSettings;
  }

  getRightConversationSettings(): ConversationSettings {
    if (!this.rightConversationSettings) {
      this.rightConversationSettings = new ConversationSettings(
        this.page,
        undefined,
        2,
      );
    }
    return this.rightConversationSettings;
  }

  getChatMessages(): ChatMessages {
    if (!this.chatMessages) {
      this.chatMessages = new ChatMessages(this.page, this.rootLocator);
    }
    return this.chatMessages;
  }

  getConversationToCompare(): ConversationToCompare {
    if (!this.conversationToCompare) {
      this.conversationToCompare = new ConversationToCompare(this.page);
    }
    return this.conversationToCompare;
  }

  getRightChatHeader(): ChatHeader {
    if (!this.rightChatHeader) {
      this.rightChatHeader = new ChatHeader(this.page, this.rootLocator, 2);
    }
    return this.rightChatHeader;
  }

  getLeftChatHeader(): ChatHeader {
    if (!this.leftChatHeader) {
      this.leftChatHeader = new ChatHeader(this.page, this.rootLocator);
    }
    return this.leftChatHeader;
  }

  public async getConversationsCount() {
    return (
      (await this.getLeftConversationSettings().getElementsCount()) +
      (await this.getRightConversationSettings().getElementsCount())
    );
  }

  public async getChatMessagesCount() {
    return this.getChatMessages().getElementsCount();
  }

  public async isConversationToCompareVisible() {
    return this.getConversationToCompare().isVisible();
  }

  public async waitForComparedConversationsLoaded() {
    await this.waitForState();
    await this.getRightChatHeader().waitForState();
    await this.getLeftChatHeader().waitForState();
    const chatMessages = this.getChatMessages().compareChatMessages;
    await chatMessages.getNthElement(0).waitFor();
    await chatMessages.getNthElement(1).waitFor();
  }
}
