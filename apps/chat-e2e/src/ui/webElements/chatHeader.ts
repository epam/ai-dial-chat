import {
  ChatHeaderSelectors,
  MenuSelectors,
  SideBarSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { Locator, Page } from '@playwright/test';

export class ChatHeader extends BaseElement {
  constructor(page: Page, parentLocator: Locator, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatHeaderSelectors.chatHeader,
      parentLocator,
    ).getNthElement(index ?? 1);
    super(page, '', elementLocator);
  }

  public chatTitle = this.getChildElementBySelector(
    ChatHeaderSelectors.chatTitle,
  );
  public chatAgent = this.getChildElementBySelector(
    ChatHeaderSelectors.chatAgent,
  );
  public chatModelIcon = this.getChildElementBySelector(
    `${ChatHeaderSelectors.chatAgent} >> ${Tags.img}`,
  );
  public chatAddonIcons = this.getChildElementBySelector(
    `${ChatHeaderSelectors.chatAddons} > ${Tags.span}`,
  );
  public deleteConversationFromComparison = this.getChildElementBySelector(
    ChatHeaderSelectors.deleteFromCompareIcon,
  );
  public conversationSettings = this.getChildElementBySelector(
    ChatHeaderSelectors.conversationSettingsIcon,
  );
  public clearConversation = this.getChildElementBySelector(
    ChatHeaderSelectors.clearConversationIcon,
  );
  public leavePlaybackMode = this.getChildElementBySelector(
    ChatHeaderSelectors.leavePlayback,
  );
  public version = this.getChildElementBySelector(ChatHeaderSelectors.version);
  public dotsMenu = this.getChildElementBySelector(MenuSelectors.dotsMenu);

  public async isArrowIconVisible() {
    return this.chatAgent
      .getChildElementBySelector(SideBarSelectors.arrowAdditionalIcon)
      .isVisible();
  }

  async getHeaderModelIcon() {
    return this.getElementIcon(this.rootLocator);
  }

  async getHeaderAddonsIcons() {
    return this.getElementIcons(this.chatAddonIcons);
  }

  async openConversationSettingsPopup() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    await this.conversationSettings.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
  }

  public async hoverOverChatModel() {
    await this.chatAgent.hoverOver();
  }

  public async hoverOverChatSettings() {
    await this.conversationSettings.hoverOver();
  }
}
