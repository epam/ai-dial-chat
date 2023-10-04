import { Tags } from '../domData';
import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { keys } from '@/e2e/src/ui/keyboard';
import { PromptList } from '@/e2e/src/ui/webElements/promptList';
import { Locator, Page } from '@playwright/test';

export class SendMessage extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.message, parentLocator);
  }

  private promptList!: PromptList;

  getPromptList() {
    if (!this.promptList) {
      this.promptList = new PromptList(this.page, this.rootLocator);
    }
    return this.promptList;
  }

  public messageInput = this.getChildElementBySelector(Tags.textarea);
  public sendMessageButton = this.getChildElementBySelector(Tags.button);
  public messageInputSpinner = this.messageInput.getChildElementBySelector(
    ChatSelectors.messageSpinner,
  );

  public async send(message: string) {
    await this.fillRequestData(message);
    await this.sendMessageButton.click();
  }

  public async sendWithEnterKey(message: string) {
    await this.fillRequestData(message);
    await this.page.keyboard.press(keys.enter);
  }

  public async getMessage() {
    return this.messageInput.getElementContent();
  }

  public async waitForMessageInputLoaded() {
    await this.messageInputSpinner.waitForState({ state: 'detached' });
  }

  private async fillRequestData(message: string) {
    await this.messageInput.waitForState();
    await this.sendMessageButton.waitForState();
    await this.messageInput.fillInInput(message);
  }
}
