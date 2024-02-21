import { isApiStorageType } from '@/src/hooks/global-setup';
import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { PromptModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { ConfirmationDialog } from '@/src/ui/webElements/confirmationDialog';
import { Page } from '@playwright/test';

export class PromptModalDialog extends BaseElement {
  constructor(page: Page) {
    super(page, PromptModal.promptModalDialog);
  }

  public name = new BaseElement(this.page, PromptModal.promptName);
  public description = new BaseElement(
    this.page,
    PromptModal.promptDescription,
  );
  public prompt = new BaseElement(this.page, PromptModal.promptValue);
  public saveButton = new BaseElement(this.page, PromptModal.savePrompt);

  public async fillPromptDetails(
    name: string,
    description: string,
    value: string,
  ) {
    await this.name.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.name.typeInInput(name);
    await this.description.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.description.typeInInput(description);
    await this.prompt.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.prompt.typeInInput(value);
  }

  private confirmationDialog!: ConfirmationDialog;

  getConfirmationDialog(): ConfirmationDialog {
    if (!this.confirmationDialog) {
      this.confirmationDialog = new ConfirmationDialog(this.page);
    }
    return this.confirmationDialog;
  }

  public async updatePromptDetailsWithButton(
    name: string,
    description: string,
    value: string,
  ) {
    await this.updatePromptDetails(name, description, value, () =>
      this.saveButton.click(),
    );
  }

  public async updatePromptDetailsWithEnter(
    name: string,
    description: string,
    value: string,
  ) {
    await this.updatePromptDetails(name, description, value, () =>
      this.page.keyboard.press(keys.enter),
    );
  }

  public async updatePromptDetails(
    name: string,
    description: string,
    value: string,
    method: () => Promise<void>,
  ) {
    await this.fillPromptDetails(name, description, value);
    const confirmationDialog = this.getConfirmationDialog();
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST',
      );
      await method();
      await confirmationDialog.confirm();
      return respPromise;
    }
    await method();
    await confirmationDialog.confirm();
  }

  public async getName() {
    return this.name.getAttribute(Attributes.value);
  }

  public async getDescription() {
    return this.description.getElementContent();
  }

  public async getPrompt() {
    return this.prompt.getElementContent();
  }
}
