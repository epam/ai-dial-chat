import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { ErrorLabelSelectors, IconSelectors } from '@/src/ui/selectors';
import { VariableModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';
import { Request } from 'playwright-core';

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
  public descriptionVar = (variable: string) =>
    this.description
      .getChildElementBySelector(Tags.span)
      .getElementLocatorByText(variable);
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

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

  public submitButton = this.getChildElementBySelector(
    VariableModal.submitVariable,
  );

  public async submitReplayVariables(
    options: { isMoveRequestTriggered: boolean } = {
      isMoveRequestTriggered: false,
    },
  ) {
    const apiPromises = [];
    const requestPromise = this.page.waitForRequest((request) =>
      request.url().includes(API.chatHost),
    );
    apiPromises.push(requestPromise);
    if (options.isMoveRequestTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.url().includes(API.moveHost) && resp.status() === 200,
      );
      apiPromises.push(respPromise);
    }
    await this.submitButton.click();

    let request: Request;
    for (let i = 0; i < apiPromises.length; i++) {
      if (i === 0) {
        request = (await apiPromises[i]) as Request;
      }
      await apiPromises[i];
    }
    return request!.postDataJSON();
  }
}
