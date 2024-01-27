import { ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { VariableModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class VariableModalDialog extends BaseElement {
  constructor(page: Page) {
    super(page, VariableModal.variableModalDialog);
  }

  public name = new BaseElement(this.page, VariableModal.variablePromptName);
  public description = new BaseElement(
    this.page,
    VariableModal.variablePromptDescription,
  );

  public getPromptVariableByPlaceholder = (placeholder: string) =>
    this.getElementByPlaceholder(
      ExpectedConstants.promptPlaceholder(placeholder),
    );

  public submitButton = new BaseElement(
    this.page,
    VariableModal.submitVariable,
  );

  public async setVariable(variable: string, value: string) {
    await this.getPromptVariableByPlaceholder(variable).fill(value);
    await this.submitButton.click();
  }

  public async getName() {
    return this.name.getElementContent();
  }

  public async getDescription() {
    return this.description.getElementContent();
  }

  public async getVariablePlaceholder(variable: string) {
    return this.getPromptVariableByPlaceholder(variable).getAttribute(
      Attributes.placeholder,
    );
  }
}
