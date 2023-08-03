import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class ChatMessages extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chatMessage);
  }

  public loadingCursor = new BaseElement(
    this.page,
    ChatSelectors.loadingCursor,
  );

  public messageContent = this.getChildElementBySelector(
    ChatSelectors.messageContent,
  );

  public async getLastMessage() {
    return this.messageContent.getRootLocator().last().innerText();
  }
}
