import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { Page } from '@playwright/test';

export class ChatMessages extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chatMessages);
  }

  public loadingCursor = new BaseElement(
    this.page,
    ChatSelectors.loadingCursor,
  );

  public async waitForResponseReceived() {
    await this.loadingCursor.waitForState({
      state: 'detached',
    });
  }

  public getChatMessage(message: string) {
    return this.getChildElementBySelector(
      ChatSelectors.chatMessage,
    ).getElementLocatorByText(message);
  }

  public getChatMessageTextarea(message: string) {
    return this.getChatMessage(message).locator(Tags.textarea);
  }

  public editIcon = new BaseElement(this.page, ChatSelectors.editIcon);
  public saveAndSubmit = new BaseElement(
    this.page,
    ChatSelectors.saveAndSubmit,
  );

  public async openEditMessageMode(message: string) {
    const chatMessage = await this.getChatMessage(message);
    await chatMessage.hover();
    await this.editIcon.click();
  }

  public async editMessage(currentMessage: string, newMessage: string) {
    const textArea = this.getChatMessageTextarea(currentMessage);
    await textArea.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    await textArea.fill(newMessage);
    await this.saveAndSubmit.click();
    await this.waitForResponseReceived();
  }
}
