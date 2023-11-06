import { Chat, ChatBar, ConversationSettings, PromptBar } from '../webElements';
import { BasePage } from './basePage';

import { ExpectedConstants } from '@/e2e/src/testData';

export class DialHomePage extends BasePage {
  private chat!: Chat;
  private chatBar!: ChatBar;
  private promptBar!: PromptBar;
  private conversationSettings!: ConversationSettings;

  getChat(): Chat {
    if (!this.chat) {
      this.chat = new Chat(this.page);
    }
    return this.chat;
  }

  getChatBar(): ChatBar {
    if (!this.chatBar) {
      this.chatBar = new ChatBar(this.page);
    }
    return this.chatBar;
  }

  getPromptBar(): PromptBar {
    if (!this.promptBar) {
      this.promptBar = new PromptBar(this.page);
    }
    return this.promptBar;
  }

  getConversationSettings(): ConversationSettings {
    if (!this.conversationSettings) {
      this.conversationSettings = new ConversationSettings(this.page);
    }
    return this.conversationSettings;
  }

  public async waitForPageLoaded(options?: {
    isNewConversationVisible?: boolean;
  }) {
    const chatBar = this.getChatBar();
    await chatBar.waitForState({ state: 'attached' });
    await this.getPromptBar().waitForState({ state: 'attached' });
    const chat = this.getChat();
    await chat.waitForState({ state: 'attached' });
    await chat.waitForChatLoaded();
    await chat.getSendMessage().waitForMessageInputLoaded();
    if (options?.isNewConversationVisible) {
      const newConversation = await chatBar
        .getConversations()
        .getConversationByName(ExpectedConstants.newConversationTitle);
      await newConversation.waitFor();
      await newConversation.waitFor({ state: 'attached' });
      const conversationSettings = this.getConversationSettings();
      await conversationSettings
        .getTalkToSelector()
        .waitForState({ state: 'attached' });
      await conversationSettings
        .getEntitySettings()
        .waitForState({ state: 'attached' });
    }
  }
}
