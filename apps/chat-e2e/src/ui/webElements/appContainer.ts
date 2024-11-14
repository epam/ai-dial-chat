import { Banner } from '@/src/ui/webElements/banner';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Chat } from '@/src/ui/webElements/chat';
import { ChatBar } from '@/src/ui/webElements/chatBar';
import { ChatLoader } from '@/src/ui/webElements/chatLoader';
import { ConversationSettings } from '@/src/ui/webElements/conversationSettings';
import { ErrorToast } from '@/src/ui/webElements/errorToast';
import { ImportExportLoader } from '@/src/ui/webElements/importExportLoader';
import { PromptBar } from '@/src/ui/webElements/promptBar';

export class AppContainer extends BaseLayoutContainer {
  private banner!: Banner;
  private chat!: Chat;
  private chatBar!: ChatBar;
  private promptBar!: PromptBar;
  private conversationSettings!: ConversationSettings;
  private chatLoader!: ChatLoader;
  private importExportLoader!: ImportExportLoader;
  private errorToast!: ErrorToast;

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
