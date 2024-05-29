import { BasePage, UploadDownloadData } from './basePage';

import { ExpectedConstants } from '@/src/testData';
import { AppContainer } from '@/src/ui/webElements/appContainer';

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
      const newConversation = await chatBar
        .getConversations()
        .getConversationByName(ExpectedConstants.newConversationTitle);
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
}
