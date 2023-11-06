import { ChatSelectors } from '../selectors';
import { BaseElement, Icons } from './baseElement';

import { Page } from '@playwright/test';

export class ChatHeader extends BaseElement {
  constructor(page: Page, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatSelectors.chatHeader,
    ).getNthElement(index ?? 1);
    super(page, '', elementLocator);
  }

  public chatTitle = new BaseElement(this.page, ChatSelectors.chatTitle);
  public icons = this.getChildElementBySelector(ChatSelectors.chatIcon);
  public chatModel = this.getChildElementBySelector(ChatSelectors.chatModel);
  public removeConversationFromComparison = this.getChildElementBySelector(
    ChatSelectors.removeFromCompareIcon,
  );
  public openConversationSettings = this.getChildElementBySelector(
    ChatSelectors.conversationSettingsIcon,
  );
  public clearConversation = this.getChildElementBySelector(
    ChatSelectors.clearConversationIcon,
  );

  async getHeaderIcons() {
    const allIcons: Icons[] = [];
    await this.icons.getNthElement(1).waitFor();
    const iconsCount = await this.icons.getElementsCount();
    for (let i = 1; i <= iconsCount; i++) {
      const customIcon = await this.icons.getNthElement(i);
      allIcons.push(await this.getElementIconAttributes(customIcon));
    }
    return allIcons;
  }
}
