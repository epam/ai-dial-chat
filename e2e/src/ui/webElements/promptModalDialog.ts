import { Attributes } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { PromptModal } from '@/e2e/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
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

  public async updatePromptDetails(
    name: string,
    description: string,
    value: string,
  ) {
    await this.fillPromptDetails(name, description, value);
    await this.saveButton.click();
  }

  public async updatePromptDetailsWithEnter(
    name: string,
    description: string,
    value: string,
  ) {
    await this.fillPromptDetails(name, description, value);
    await this.page.keyboard.press(keys.enter);
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
