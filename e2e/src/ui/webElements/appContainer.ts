import { appContainer } from '@/e2e/src/ui/selectors';
import { Banner } from '@/e2e/src/ui/webElements/banner';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Chat } from '@/e2e/src/ui/webElements/chat';
import { ChatBar } from '@/e2e/src/ui/webElements/chatBar';
import { ConversationSettings } from '@/e2e/src/ui/webElements/conversationSettings';
import { Header } from '@/e2e/src/ui/webElements/header';
import { PromptBar } from '@/e2e/src/ui/webElements/promptBar';
import { Page } from '@playwright/test';

export class AppContainer extends BaseElement {
  constructor(page: Page) {
    super(page, appContainer);
  }

  private header!: Header;
  private banner!: Banner;
  private chat!: Chat;
  private chatBar!: ChatBar;
  private promptBar!: PromptBar;
  private conversationSettings!: ConversationSettings;

  getHeader(): Header {
    if (!this.header) {
      this.header = new Header(this.page);
    }
    return this.header;
  }

  getBanner(): Banner {
    if (!this.banner) {
      this.banner = new Banner(this.page);
    }
    return this.banner;
  }

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
}
