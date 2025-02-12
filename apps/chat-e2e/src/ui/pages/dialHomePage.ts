import { BasePage, UploadDownloadData } from './basePage';

import config from '@/config/chat.playwright.config';
import { SharedPromptPreviewModal } from '@/src/ui/webElements';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { Request } from 'playwright-chromium';
import { PageFunction } from 'playwright-core/types/structs';

export const loadingTimeout = config.use!.actionTimeout! * 2;

export class DialHomePage extends BasePage {
  private appContainer!: AppContainer;

  getAppContainer(): AppContainer {
    if (!this.appContainer) {
      this.appContainer = new AppContainer(this.page);
    }
    return this.appContainer;
  }

  public async waitForPageLoaded(options?: {
    selectedSharedConversationName?: string;
    selectedSharedFolderName?: string;
    isPromptShared?: boolean;
    skipSidebars?: boolean;
  }) {
    const appContainer = this.getAppContainer();
    if (!options?.skipSidebars) {
      const chatBar = appContainer.getChatBar();
      const promptBar = appContainer.getPromptBar();
      await chatBar.waitForState({ state: 'attached' });
      await promptBar.waitForState({ state: 'attached' });
      await chatBar
        .getChatLoader()
        .waitForState({ state: 'hidden', timeout: loadingTimeout });
      await promptBar.getChatLoader().waitForState({
        state: 'hidden',
        timeout: loadingTimeout,
      });
    }

    //workaround for the issue https://github.com/epam/ai-dial-chat/issues/1596
    try {
      await appContainer
        .getChatLoader()
        .waitForState({ state: 'hidden', timeout: loadingTimeout });
    } catch (error) {
      await this.reloadPage();
      await this.waitForPageLoaded(options);
    }
    const chat = appContainer.getChat();
    await chat.waitForState({ state: 'attached' });
    await chat.waitForChatLoaded();
    await chat.getSendMessage().waitForMessageInputLoaded();
    if (!options?.skipSidebars) {
      const chatBar = appContainer.getChatBar();
      if (
        options?.selectedSharedConversationName &&
        !options.selectedSharedFolderName
      ) {
        const sharedConversation = chatBar
          .getSharedWithMeConversationsTree()
          .getEntityByName(options.selectedSharedConversationName);
        await sharedConversation.waitFor();
        await sharedConversation.waitFor({ state: 'attached' });
        await chat.getChatHeader().waitForState();
      } else if (
        options?.selectedSharedConversationName &&
        options.selectedSharedFolderName
      ) {
        const sharedFolderConversation = chatBar
          .getSharedFolderConversations()
          .getFolderEntity(
            options.selectedSharedFolderName,
            options.selectedSharedConversationName,
          );
        await sharedFolderConversation.waitFor();
        await sharedFolderConversation.waitFor({ state: 'attached' });
        await chat.getChatHeader().waitForState();
      } else if (options?.isPromptShared) {
        const promptPreviewModal = new SharedPromptPreviewModal(this.page);
        await promptPreviewModal.waitForState();
        await promptPreviewModal.promptName.waitForState();
      } else {
        await chat.getAgentInfo().waitForState({ state: 'attached' });
        await chat.configureSettingsButton.waitForState({
          state: 'attached',
        });
      }
    }
  }

  async reloadPage() {
    await super.reloadPage();
    const appContainer = this.getAppContainer();
    await appContainer
      .getChatBar()
      .getChatLoader()
      .waitForState({ state: 'hidden', timeout: loadingTimeout });
    await appContainer
      .getPromptBar()
      .getChatLoader()
      .waitForState({ state: 'hidden', timeout: loadingTimeout });
  }

  async importFile<T>(
    uploadData: UploadDownloadData,
    method: () => Promise<T>,
  ) {
    const respPromise = this.page.waitForResponse(
      (r) => r.request().method() === 'POST',
    );
    await this.uploadData(uploadData, method);
    await respPromise;
    await this.getAppContainer()
      .getImportExportLoader()
      .waitForState({ state: 'hidden' });
    await this.getAppContainer()
      .getChatLoader()
      .waitForState({ state: 'hidden', timeout: loadingTimeout });
    await this.page.waitForLoadState('domcontentloaded');
  }

  public async addInitScript<Arg>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    script: PageFunction<Arg, any> | { path?: string; content?: string },
    arg?: Arg,
  ): Promise<void> {
    await this.page.addInitScript(script, arg);
  }

  public async waitForRequest({
    method,
    urlPattern,
    timeout = 5000,
    shouldNotOccur = false,
  }: {
    method: 'PUT' | 'DELETE' | 'POST' | 'GET';
    urlPattern?: string | RegExp;
    timeout?: number;
    shouldNotOccur?: boolean;
  }) {
    const matchRequest = (request: Request) => {
      const methodMatches = request.method() === method;
      if (!urlPattern) return methodMatches;
      return (
        methodMatches &&
        (urlPattern instanceof RegExp
          ? urlPattern.test(request.url())
          : request.url().includes(urlPattern))
      );
    };

    if (shouldNotOccur) {
      try {
        await this.page.waitForRequest(matchRequest, { timeout: timeout });
        // If we get here, we found a request when we shouldn't have
        throw new Error(`Unexpected ${method} request was sent`);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('Timeout')) {
          // Timeout is expected and good in this case
          return;
        }
        throw error;
      }
    } else {
      return this.page.waitForRequest(matchRequest, { timeout });
    }
  }
}
