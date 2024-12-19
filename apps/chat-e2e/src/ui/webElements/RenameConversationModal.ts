import { BaseElement } from './baseElement';

import { Attributes, Tags } from '@/src/ui/domData';
import { RenameConversationModalSelectors } from '@/src/ui/selectors';
import { Page } from '@playwright/test';

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
  // public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
  public nameInput = this.getChildElementBySelector(Tags.input);

  async rename(newName: string) {
    await this.nameInput.fillInInput(newName);
    await this.saveButton.click();
  }

  async close() {
    await this.cancelButton.click();
  }

  async getInputValue() {
    return this.nameInput.getAttribute(Attributes.value);
  }
}
