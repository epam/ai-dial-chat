import { isApiStorageType } from '@/src/hooks/global-setup';
import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { ErrorLabelSelectors } from '@/src/ui/selectors';
import { PromptModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class PromptModalDialog extends BaseElement {
  constructor(page: Page) {
    super(page, PromptModal.promptModalDialog);
  }

  public name = this.getChildElementBySelector(PromptModal.promptName);
  public description = this.getChildElementBySelector(
    PromptModal.promptDescription,
  );
  public prompt = this.getChildElementBySelector(PromptModal.promptValue);
  public saveButton = this.getChildElementBySelector(PromptModal.savePrompt);
  public closeButton = this.getChildElementBySelector(PromptModal.closePrompt);
  public fieldLabel = (label: string) =>
    this.getChildElementBySelector(PromptModal.fieldLabel(label));
  public getFieldBottomMessage = (field: BaseElement) =>
    field.getElementLocator().locator(`~${ErrorLabelSelectors.fieldError}`);

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

  public async setField(field: BaseElement, value: string) {
    await field.click();
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.page.keyboard.press(keys.delete);
    await field.typeInInput(value);
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
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST',
      );
      await method();
      return respPromise;
    }
    await method();
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

  public async isFieldHasAsterisk(label: string) {
    return this.fieldLabel(label).getElementLocatorByText('*').isVisible();
  }
}
