import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Page } from '@playwright/test';

export class SendMessage extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.message);
  }

  public messageInput = this.getChildElementBySelector(Tags.textarea);
  public sendMessageButton = this.getChildElementBySelector(Tags.button);

  public async send(message: string) {
    await this.messageInput.fillInInput(message);
    await this.sendMessageButton.click();
  }
}
