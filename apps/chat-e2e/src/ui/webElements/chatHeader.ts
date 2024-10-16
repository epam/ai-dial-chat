import { ChatHeaderSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { API } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
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
  public chatModel = this.getChildElementBySelector(
    ChatHeaderSelectors.chatModel,
  );
  public chatModelIcon = this.getChildElementBySelector(
    `${ChatHeaderSelectors.chatModel} >> ${Tags.img}`,
  );
  public chatAddonIcons = this.getChildElementBySelector(
    `${ChatHeaderSelectors.chatAddons} > ${Tags.span}`,
  );
  public deleteConversationFromComparison = this.getChildElementBySelector(
    ChatHeaderSelectors.deleteFromCompareIcon,
  );
  public openConversationSettings = this.getChildElementBySelector(
    ChatHeaderSelectors.conversationSettingsIcon,
  );
  public clearConversation = this.getChildElementBySelector(
    ChatHeaderSelectors.clearConversationIcon,
  );
  public leavePlaybackMode = this.getChildElementBySelector(
    ChatHeaderSelectors.leavePlayback,
  );

  public async isArrowIconVisible() {
    return this.chatModel
      .getChildElementBySelector(SideBarSelectors.arrowAdditionalIcon)
      .isVisible();
  }

  async getHeaderModelIcon() {
    return this.getElementIconHtml(this.rootLocator);
  }

  async getHeaderAddonsIcons() {
    return this.getElementIcons(this.chatAddonIcons, Attributes.title);
  }

  async openConversationSettingsPopup() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    await this.openConversationSettings.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
  }

  public async hoverOverChatModel() {
    await this.chatModel.hoverOver();
  }
}
