import { BasePage, UploadDownloadData } from './basePage';

import { API, ExpectedConstants } from '@/src/testData';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { BucketUtil } from '@/src/utils';

export class DialHomePage extends BasePage {
  private appContainer!: AppContainer;

  getAppContainer(): AppContainer {
    if (!this.appContainer) {
      this.appContainer = new AppContainer(this.page);
    }
    return this.appContainer;
  }

  public async waitForPageLoaded(options?: {
    isNewConversationVisible?: boolean;
  }) {
    const appContainer = this.getAppContainer();
    const chatBar = appContainer.getChatBar();
    const promptBar = appContainer.getPromptBar();
    await chatBar.waitForState({ state: 'attached' });
    await promptBar.waitForState({ state: 'attached' });
    await chatBar.getChatLoader().waitForState({ state: 'hidden' });
    await promptBar.getChatLoader().waitForState({ state: 'hidden' });
    await appContainer.getChatLoader().waitForState({ state: 'hidden' });
    const chat = appContainer.getChat();
    await chat.waitForState({ state: 'attached' });
    await chat.waitForChatLoaded();
    await chat.getSendMessage().waitForMessageInputLoaded();
    if (options?.isNewConversationVisible) {
      const newConversation = chatBar
        .getConversationsTree()
        .getEntityByName(ExpectedConstants.newConversationTitle);
      await newConversation.waitFor();
      await newConversation.waitFor({ state: 'attached' });
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
      .waitForState({ state: 'hidden' });
    await appContainer
      .getPromptBar()
      .getChatLoader()
      .waitForState({ state: 'hidden' });
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
      .waitForState({ state: 'hidden' });
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
