import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { BackendEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { ApplicationEditorHeader } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
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

  public async getActionAndApplicationTypeTitle() {
    return this.actionAndApplicationTypeTitle.getElementLocator().textContent();
  }

  public async getAllStepTitlesTexts() {
    const stepTitles = await this.getAllStepTitles();
    let stepTitleTexts = [];
    for (let i = 0; i < stepTitles.length; i++) {
      stepTitleTexts.push(await stepTitles[i].textContent());
    }
    return stepTitleTexts;
  }

  public async getAllSteps() {
    return this.singleStep.getElementLocator().all();
  }

  public async getAllStepTitles() {
    return this.singleStepTitle.getElementLocator().all();
  }

  public async getStepByTitle(title: string, index = 0) {
    return this.stepsContainer
      .getElementLocator()
      .locator(ApplicationEditorHeader.singleStepLink)
      .filter({
        has: this.page.locator(
          `${ApplicationEditorHeader.singleStepTitle}:text("${title}")`,
        ),
      })
      .nth(index);
  }

  public async getStepLinkByTitle(title: string): Promise<string | null> {
    const stepLocator = await this.getStepByTitle(title);
    return stepLocator.getAttribute('href');
  }

  public getGeneralInfoStep() {
    return this.getStepByTitle(AppEditSteps.generalInfo);
  }

  public getAppSettingsStep() {
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
