import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { PromptList } from '@/e2e/src/ui/webElements/promptList';
import { Page } from '@playwright/test';

export class SendMessage extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.message);
  }

  private promptList!: PromptList;

  getPromptList() {
    if (!this.promptList) {
      this.promptList = new PromptList(this.page);
    }
    return this.promptList;
  }

  public messageInput = this.getChildElementBySelector(Tags.textarea);
  public sendMessageButton = this.getChildElementBySelector(Tags.button);

  public async send(message: string) {
    await this.messageInput.fillInInput(message);
    await this.sendMessageButton.click();
  }

  public async getMessage() {
    return this.messageInput.getElementContent();
  }
}
