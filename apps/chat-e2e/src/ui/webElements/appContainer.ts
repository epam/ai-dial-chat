import { Banner } from '@/src/ui/webElements/banner';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Chat } from '@/src/ui/webElements/chat';
import { ChatBar } from '@/src/ui/webElements/chatBar';
import { ChatLoader } from '@/src/ui/webElements/chatLoader';
import { ImportExportLoader } from '@/src/ui/webElements/importExportLoader';
import { PromptBar } from '@/src/ui/webElements/promptBar';
import { Toast } from '@/src/ui/webElements/toast';

export class AppContainer extends BaseLayoutContainer {
  private banner!: Banner;
  private chat!: Chat;
  private chatBar!: ChatBar;
  private promptBar!: PromptBar;
  private chatLoader!: ChatLoader;
  private importExportLoader!: ImportExportLoader;
  private toast!: Toast;

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
      this.chatBar = new ChatBar(this.page, this.rootLocator);
    }
    return this.chatBar;
  }

  getPromptBar(): PromptBar {
    if (!this.promptBar) {
      this.promptBar = new PromptBar(this.page, this.rootLocator);
    }
    return this.promptBar;
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

  getToast(): Toast {
    if (!this.toast) {
      this.toast = new Toast(this.page);
    }
    return this.toast;
  }
}
