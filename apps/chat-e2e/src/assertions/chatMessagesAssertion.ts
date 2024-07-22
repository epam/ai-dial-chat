import { ExpectedMessages } from '@/src/testData';
import { ChatMessages } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChatMessagesAssertion {
  readonly chatMessages: ChatMessages;

  constructor(chatMessages: ChatMessages) {
    this.chatMessages = chatMessages;
  }

  public async assertMessagesWidth(option: { hasFullWidth: boolean }) {
    const messageMaxWidth = this.chatMessages.getChatMessageMaxWidth(1);
    option.hasFullWidth
      ? await expect
          .soft(messageMaxWidth, ExpectedMessages.elementWidthIsValid)
          .toBeVisible()
      : await expect
          .soft(messageMaxWidth, ExpectedMessages.elementWidthIsValid)
          .toBeHidden();
  }
}
