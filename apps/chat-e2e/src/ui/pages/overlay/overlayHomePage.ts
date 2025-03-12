import { loadingTimeout } from '@/src/ui/pages';
import { OverlayBasePage } from '@/src/ui/pages/overlay/overlayBasePage';
import { AppContainer } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class OverlayHomePage extends OverlayBasePage<AppContainer> {
  constructor(page: Page) {
    super(page, new AppContainer(page));
  }

  public async waitForPageLoaded() {
    const overlayAppContainer = this.getOverlayContainer();
    await overlayAppContainer
      .getChatLoader()
      .waitForState({ state: 'hidden', timeout: loadingTimeout });
    const overlayChat = overlayAppContainer.getChat();
    await overlayChat.waitForState({ state: 'attached' });
    await overlayChat.waitForChatLoaded();
    await overlayChat.getSendMessage().waitForMessageInputLoaded();
    await overlayChat.getAgentInfo().waitForState({ state: 'attached' });
  }
}
