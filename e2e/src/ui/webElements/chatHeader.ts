import { ChatSelectors } from '../selectors';
import { BaseElement, EntityIcon } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
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
  public removeConversationFromComparison = this.getChildElementBySelector(
    ChatSelectors.removeFromCompareIcon,
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

  async getHeaderModelIcon() {
    await this.chatModelIcon.waitForState();
    return this.getElementIconHtml(this.rootLocator);
  }

  async getHeaderAddonsIcons() {
    const allIcons: EntityIcon[] = [];
    await this.chatAddonIcons.getNthElement(1).waitFor();
    const addonsCount = await this.chatAddonIcons.getElementsCount();
    for (let i = 1; i <= addonsCount; i++) {
      const addon = await this.chatAddonIcons.getNthElement(i);
      const addonName = await addon.locator(Tags.desc).textContent();
      const iconHtml = await this.getElementIconHtml(addon);
      allIcons.push({ entityName: addonName!, icon: iconHtml });
    }
    return allIcons;
  }
}
