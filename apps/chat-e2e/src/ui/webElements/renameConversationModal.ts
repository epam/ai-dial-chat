import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { Attributes, Tags } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
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
  public nameInput = this.getChildElementBySelector(Tags.input);
  public title = this.getChildElementBySelector(
    RenameConversationModalSelectors.title,
  );

  private async editConversationName(
    newName: string,
    confirmationAction: () => Promise<void>,
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    await this.nameInput.fillInInput(newName);
    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await confirmationAction();
      await respPromise;
    } else {
      await confirmationAction();
    }
  }

  async editConversationNameWithSaveButton(
    newName: string,
    options?: { isHttpMethodTriggered?: boolean },
  ) {
    await this.editConversationName(
      newName,
      () => this.saveButton.click(),
      options,
    );
  }

  async editConversationNameWithEnter(
    newName: string,
    options?: { isHttpMethodTriggered?: boolean },
  ) {
    await this.editConversationName(
      newName,
      () => this.page.keyboard.press(keys.enter),
      options,
    );
  }

  async close() {
    await this.cancelButton.click();
  }

  async getInputValue() {
    return this.nameInput.getAttribute(Attributes.value);
  }

  public async editInputValue(newValue: string) {
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.nameInput.fillInInput(newValue);
  }
}
