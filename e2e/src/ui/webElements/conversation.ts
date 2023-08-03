import { ChatBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class Conversation extends BaseElement {
  constructor(page: Page) {
    super(page, ChatBarSelectors.conversation);
  }

  public getConversationByName(name: string, index?: number) {
    return this.getElementLocatorByText(name, index);
  }

  public async selectConversation(name: string, index?: number) {
    await this.getConversationByName(name, index).click();
  }
}
