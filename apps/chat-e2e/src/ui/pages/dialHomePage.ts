import { BasePage } from './basePage';

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
    await chatBar.waitForState({ state: 'attached' });
    await appContainer.getPromptBar().waitForState({ state: 'attached' });
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
}
