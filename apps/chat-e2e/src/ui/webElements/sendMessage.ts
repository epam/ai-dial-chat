import {
  ChatSelectors,
  MessageInputSelectors,
  SendMessageSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { keys } from '@/src/ui/keyboard';
import { MenuSelectors } from '@/src/ui/selectors/menuSelectors';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { InputAttachments } from '@/src/ui/webElements/inputAttachments';
import { PromptList } from '@/src/ui/webElements/promptList';
import { Locator, Page } from '@playwright/test';

export class SendMessage extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, SendMessageSelectors.message, parentLocator);
  }

  private promptList!: PromptList;
  private dropdownMenu!: DropdownMenu;
  private inputAttachments!: InputAttachments;

  getPromptList() {
    if (!this.promptList) {
      this.promptList = new PromptList(this.page, this.rootLocator);
    }
    return this.promptList;
  }

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  getInputAttachments(): InputAttachments {
    if (!this.inputAttachments) {
      this.inputAttachments = new InputAttachments(this.page, this.rootLocator);
    }
    return this.inputAttachments;
  }

  public messageInput = this.getChildElementBySelector(
    MessageInputSelectors.textarea,
  );
  public sendMessageButton = this.getChildElementBySelector(
    SendMessageSelectors.sendMessage,
  );
  public messageInputSpinner = this.messageInput.getChildElementBySelector(
    ChatSelectors.messageSpinner,
  );
  public attachmentMenuTrigger = this.getChildElementBySelector(
    MenuSelectors.menuTrigger,
  );

  public scrollDownButton = this.getChildElementBySelector(
    SendMessageSelectors.scrollDownButton,
  );

  public stopGenerating = this.getChildElementBySelector(
    SendMessageSelectors.stopGenerating,
  );
  public regenerate = this.getChildElementBySelector(ChatSelectors.regenerate);

  public proceedGenerating = this.getChildElementBySelector(
    SendMessageSelectors.proceedGenerating,
  );

  public async send(message?: string) {
    await this.fillRequestData(message);
    await this.sendMessageButton.click();
  }

  public async sendWithEnterKey(message?: string) {
    await this.fillRequestData(message);
    await this.page.keyboard.press(keys.enter);
  }

  public async getMessage() {
    return this.messageInput.getElementContent();
  }

  public async waitForMessageInputLoaded() {
    await this.messageInputSpinner.waitForState({ state: 'detached' });
  }

  public async pasteDataIntoMessageInput() {
    await this.messageInput.waitForState();
    await this.messageInput.click();
    await this.page.keyboard.press(keys.ctrlPlusV);
  }

  public async clearMessageInput() {
    await this.messageInput.getElementLocator().clear();
  }

  public async fillRequestData(message?: string) {
    await this.messageInput.waitForState();
    await this.sendMessageButton.waitForState();
    message
      ? await this.messageInput.fillInInput(message)
      : await this.messageInput.click();
  }
}
