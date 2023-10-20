import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Attributes } from '@/e2e/src/ui/domData';
import { Page } from '@playwright/test';

export interface Icons {
  iconEntity: string;
  iconUrl: string;
}

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
      const icon = await this.icons.getNthElement(i);
      const iconEntity = await icon.getAttribute(Attributes.alt);
      const iconUrl = await icon.getAttribute(Attributes.src);
      allIcons.push({
        iconEntity: iconEntity!.replaceAll(' icon', ''),
        iconUrl: iconUrl!,
      });
    }
    return allIcons;
  }
}
