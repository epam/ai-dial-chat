import { BasePage, UploadDownloadData } from './basePage';

import config from '@/config/chat.playwright.config';
import { API } from '@/src/testData';
import { SharedPromptPreviewModal } from '@/src/ui/webElements';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { BucketUtil } from '@/src/utils';

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
  }) {
    const appContainer = this.getAppContainer();
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
      const conversationSettings = appContainer.getConversationSettings();
      await conversationSettings
        .getTalkToSelector()
        .waitForState({ state: 'attached' });
      await conversationSettings
        .getEntitySettings()
        .waitForState({ state: 'attached' });
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

  public async mockChatImageResponse(modelId: string, imageName: string) {
    await this.page.route(API.chatHost, async (route) => {
      await route.fulfill({
        status: 200,
        body: `{"responseId":"0dea98ff-1e66-4294-8542-457890e5f8c0"}\u0000{"role":"assistant"}\u0000{"custom_content":{"attachments":[{"index":0,"type":"image/jpg","title":"Image","url":"${API.importFilePath(BucketUtil.getBucket(), modelId)}/${imageName}"}]}}\u0000{"content":" "}\u0000{}\u0000`,
      });
    });
  }

  public async mockChatTextResponse(responseBody: string) {
    await this.page.route(API.chatHost, async (route) => {
      await route.fulfill({
        status: 200,
        body: responseBody,
      });
    });
  }
}
