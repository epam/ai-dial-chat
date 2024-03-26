import { ChatSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { Page } from '@playwright/test';

export class ChatHeader extends BaseElement {
  constructor(page: Page, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatSelectors.chatHeader,
    ).getNthElement(index ?? 1);
    super(page, '', elementLocator);
  }

  public chatTitle = this.getChildElementBySelector(ChatSelectors.chatTitle);
  public chatModel = this.getChildElementBySelector(ChatSelectors.chatModel);
  public chatModelIcon = this.getChildElementBySelector(
    `${ChatSelectors.chatModel} >> ${Tags.svg}`,
  );
  public chatAddonIcons = this.getChildElementBySelector(
    `${ChatSelectors.chatAddons} > ${Tags.span}`,
  );
  public deleteConversationFromComparison = this.getChildElementBySelector(
    ChatSelectors.deleteFromCompareIcon,
  );
  public openConversationSettings = this.getChildElementBySelector(
    ChatSelectors.conversationSettingsIcon,
  );
  public clearConversation = this.getChildElementBySelector(
    ChatSelectors.clearConversationIcon,
  );
  public leavePlaybackMode = this.getChildElementBySelector(
    ChatSelectors.leavePlayback,
  );

  public async isArrowIconVisible() {
    return this.chatModel
      .getChildElementBySelector(SideBarSelectors.arrowAdditionalIcon)
      .isVisible();
  }

  async getHeaderModelIcon() {
    await this.chatModelIcon.waitForState();
    return this.getElementIconHtml(this.rootLocator);
  }

  async getHeaderAddonsIcons() {
    return this.getElementIcons(this.chatAddonIcons, Tags.desc);
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
