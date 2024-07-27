import { Tags } from '@/src/ui/domData';
import { ErrorLabelSelectors } from '@/src/ui/selectors';
import { VariableModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class VariableModalDialog extends BaseElement {
  constructor(page: Page) {
    super(page, VariableModal.variableModalDialog);
  }

  public name = this.getChildElementBySelector(
    VariableModal.variablePromptName,
  );
  public description = this.getChildElementBySelector(
    VariableModal.variablePromptDescription,
  );

  public getPromptVariableByLabel = (label: string) =>
    this.getChildElementBySelector(VariableModal.variable)
      .getElementLocator()
      .filter({
        has: this.page.locator(
          `${VariableModal.variableLabel}:text-is('${label}')`,
        ),
      });

  public getPromptVariableLabel = (label: string) =>
    this.getPromptVariableByLabel(label).locator(VariableModal.variableLabel);

  public getPromptVariableLabelAsterisk = (label: string) =>
    this.getPromptVariableByLabel(label).locator(
      VariableModal.variableAsterisk,
    );

  public getPromptVariableValue = (label: string) =>
    this.getPromptVariableByLabel(label).locator(Tags.textarea);

  public getPromptVariableValueElement = (label: string) =>
    this.createElementFromLocator(this.getPromptVariableValue(label));

  public getPromptVariableBottomMessage = (label: string) =>
    this.createElementFromLocator(
      this.getPromptVariableByLabel(label).locator(
        ErrorLabelSelectors.fieldError,
      ),
    );

  public async setVariableValue(label: string, value: string) {
    await this.getPromptVariableValue(label).fill(value);
  }

  public submitButton = new BaseElement(
    this.page,
    VariableModal.submitVariable,
  );
}
