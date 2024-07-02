import { appContainer } from '@/src/ui/selectors';
import { Banner } from '@/src/ui/webElements/banner';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Chat } from '@/src/ui/webElements/chat';
import { ChatBar } from '@/src/ui/webElements/chatBar';
import { ChatLoader } from '@/src/ui/webElements/chatLoader';
import { ConversationSettings } from '@/src/ui/webElements/conversationSettings';
import { ErrorToast } from '@/src/ui/webElements/errorToast';
import { Header } from '@/src/ui/webElements/header';
import { ImportExportLoader } from '@/src/ui/webElements/importExportLoader';
import { PromptBar } from '@/src/ui/webElements/promptBar';
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
  private chatLoader!: ChatLoader;
  private importExportLoader!: ImportExportLoader;
  private errorToast!: ErrorToast;

  getHeader(): Header {
    if (!this.header) {
      this.header = new Header(this.page, this.rootLocator);
    }
    return this.header;
  }

  getBanner(): Banner {
    if (!this.banner) {
      this.banner = new Banner(this.page, this.rootLocator);
    }
    return this.banner;
  }

  getChat(): Chat {
    if (!this.chat) {
      this.chat = new Chat(this.page, this.rootLocator);
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
      this.conversationSettings = new ConversationSettings(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationSettings;
  }

  getChatLoader(): ChatLoader {
    if (!this.chatLoader) {
      this.chatLoader = new ChatLoader(this.page, this.rootLocator);
    }
    return this.chatLoader;
  }

  getImportExportLoader(): ImportExportLoader {
    if (!this.importExportLoader) {
      this.importExportLoader = new ImportExportLoader(
        this.page,
        this.rootLocator,
      );
    }
    return this.importExportLoader;
  }

  getErrorToast(): ErrorToast {
    if (!this.errorToast) {
      this.errorToast = new ErrorToast(this.page);
    }
    return this.errorToast;
  }
}
