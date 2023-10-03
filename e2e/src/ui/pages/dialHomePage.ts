import { Chat, ChatBar, PromptBar } from '../webElements';
import { BasePage } from './basePage';

export class DialHomePage extends BasePage {
  private chat!: Chat;
  private chatBar!: ChatBar;
  private promptBar!: PromptBar;

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

  public async waitForPageLoaded() {
    await this.getChatBar().waitForState({ state: 'attached' });
    await this.getPromptBar().waitForState({ state: 'attached' });
    const chat = this.getChat();
    await chat.waitForState({ state: 'attached' });
    await chat.waitForChatLoaded();
    await chat.getSendMessage().waitForMessageInputLoaded();
  }
}
