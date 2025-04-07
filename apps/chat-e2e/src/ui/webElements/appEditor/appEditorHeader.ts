import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { BackendEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { ApplicationEditorHeader } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export enum AppEditSteps {
  generalInfo = 'General info',
  appSettings = 'App settings',
}

export class AppEditorHeader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ApplicationEditorHeader.header, parentLocator);
  }

  public saveAndExitButton = this.getChildElementBySelector(
    ApplicationEditorHeader.saveAndExitButton,
  );
  public exitLink = this.getChildElementBySelector(
    ApplicationEditorHeader.exitLink,
  );
  public actionAndApplicationTypeTitle = this.getChildElementBySelector(
    ApplicationEditorHeader.actionAndApplicationTypeTitle,
  );
  public stepsContainer = this.getChildElementBySelector(
    ApplicationEditorHeader.stepsContainer,
  );
  public singleStep = this.getChildElementBySelector(
    ApplicationEditorHeader.singleStepLink,
  );
  public singleStepTitle = this.getChildElementBySelector(
    ApplicationEditorHeader.singleStepTitle,
  );

  public selectedIcon(step: BaseElement) {
    return step.getChildElementBySelector(
      ApplicationEditorHeader.selectedStepIcon,
    );
  }

  public notSelectedIcon(step: BaseElement) {
    return step.getChildElementBySelector(
      ApplicationEditorHeader.notSelectedStepIcon,
    );
  }

  public getStepByTitle(title: string, index?: number): BaseElement {
    const locator = this.stepsContainer
      .getChildElementBySelector(ApplicationEditorHeader.singleStepLink)
      .getElementLocatorByText(
        new RegExp(`^${RegexUtil.escapeRegexChars(title)}$`),
        index,
      );
    return this.createElementFromLocator(locator);
  }

  public getGeneralInfoStep(): BaseElement {
    return this.getStepByTitle(AppEditSteps.generalInfo);
  }

  public getAppSettingsStep(): BaseElement {
    return this.getStepByTitle(AppEditSteps.appSettings);
  }

  public async saveAppAndExit() {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(API.applicationCreateHost) &&
        resp.request().method() === 'PUT',
    );
    await this.saveAndExitButton.click();
    const resolvedResp = await respPromise;
    const requestBody = resolvedResp.request().postDataJSON();
    const responseBody = await resolvedResp.json();
    return {
      request: requestBody as ApiApplicationModelRegular,
      response: responseBody as BackendEntity,
    };
  }
}
