import { BaseElement } from './baseElement';

import { Attributes, Tags } from '@/src/ui/domData';
import { RenameConversationModalSelectors } from '@/src/ui/selectors';
import { Page } from '@playwright/test';
import {keys} from "@/src/ui/keyboard";
import {isApiStorageType} from "@/src/hooks/global-setup";

export class RenameConversationModal extends BaseElement {
  constructor(page: Page) {
    super(page, RenameConversationModalSelectors.modal);
  }

  public cancelButton = this.getChildElementBySelector(
    RenameConversationModalSelectors.cancelButton,
  );
  public saveButton = this.getChildElementBySelector(
    RenameConversationModalSelectors.saveButton,
  );
  public nameInput = this.getChildElementBySelector(Tags.input);
  public title = this.getChildElementBySelector(RenameConversationModalSelectors.title);

  async editConversationNameWithSaveButton(
    newName: string,
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {}
  ) {
    await this.nameInput.fillInInput(newName);
    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await this.saveButton.click();
      await respPromise;
    } else {
      await this.saveButton.click();
    }
  }

  async editConversationNameWithEnter(newName: string, { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {}) {
    await this.nameInput.fillInInput(newName);
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await this.page.keyboard.press(keys.enter);
      await respPromise;
    } else {
      await this.page.keyboard.press(keys.enter);
    }
  }

  async close() {
    await this.cancelButton.click();
  }

  async getInputValue() {
    return this.nameInput.getAttribute(Attributes.value);
  }
}
