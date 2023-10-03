import { BaseElement } from './baseElement';
import { ConversationSettings } from './conversationSettings';

import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { ChatHeader } from '@/e2e/src/ui/webElements/chatHeader';
import { ChatMessages } from '@/e2e/src/ui/webElements/chatMessages';
import { ConversationToCompare } from '@/e2e/src/ui/webElements/conversationToCompare';
import { Page } from '@playwright/test';

export class Compare extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.compareMode);
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
      this.rightConversationSettings = new ConversationSettings(this.page, 2);
    }
    return this.rightConversationSettings;
  }

  getChatMessages(): ChatMessages {
    if (!this.chatMessages) {
      this.chatMessages = new ChatMessages(this.page);
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
      this.rightChatHeader = new ChatHeader(this.page, 2);
    }
    return this.rightChatHeader;
  }

  getLeftChatHeader(): ChatHeader {
    if (!this.leftChatHeader) {
      this.leftChatHeader = new ChatHeader(this.page);
    }
    return this.leftChatHeader;
  }

  public async gerConversationsCount() {
    return (
      (await this.getLeftConversationSettings().getElementsCount()) +
      (await this.getRightConversationSettings().getElementsCount())
    );
  }

  public async gerChatMessagesCount() {
    return this.getChatMessages().getElementsCount();
  }

  public async isConversationToCompareVisible() {
    return this.getConversationToCompare().isVisible();
  }
}
