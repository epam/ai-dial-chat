import { loadingTimeout } from '@/src/ui/pages';
import { OverlayBasePage } from '@/src/ui/pages/overlay/overlayBasePage';
import { HeaderSelectors } from '@/src/ui/selectors';
import { AppContainer, BaseElement } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class OverlayHomePage extends OverlayBasePage<AppContainer> {
  constructor(page: Page) {
    super(page, new AppContainer(page));
  }

  public leftPanelToggle = new BaseElement(
    this.page,
    HeaderSelectors.leftPanelToggle,
    this.getOverlayContainer().getElementLocator(),
  );
  public rightPanelToggle = new BaseElement(
    this.page,
    HeaderSelectors.rightPanelToggle,
    this.getOverlayContainer().getElementLocator(),
  );

  public async waitForPageLoaded() {
    const overlayAppContainer = this.getOverlayContainer();
    await overlayAppContainer.waitForState({ state: 'attached' });
    await overlayAppContainer.waitForAppLoaded(loadingTimeout);
    const overlayChat = overlayAppContainer.getFileDropArea().getChat();
    await overlayChat.waitForState({ state: 'attached' });
    await overlayChat.waitForChatLoaded();
    await overlayChat.getSendMessage().waitForMessageInputLoaded();
    await overlayChat.getAgentInfo().waitForState({ state: 'attached' });
  }
}
