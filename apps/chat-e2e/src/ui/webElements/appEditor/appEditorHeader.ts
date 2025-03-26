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
  public selectedIconLocator = this.getChildElementBySelector(
    ApplicationEditorHeader.selectedStepIcon,
  );
  public notSelectedIconLocator = this.getChildElementBySelector(
    ApplicationEditorHeader.notSelectedStepIcon,
  );

  public async getActionAndApplicationTypeTitle() {
    return this.actionAndApplicationTypeTitle.getElementLocator().textContent();
  }

  public async getAllStepTitlesTexts(): Promise<(string | null)[]> {
    const stepTitleElements = await this.getAllStepTitles(); // Gets BaseElement[]
    const stepTitleTexts: (string | null)[] = [];
    for (const titleElement of stepTitleElements) {
      stepTitleTexts.push(await titleElement.getElementLocator().textContent());
    }
    return stepTitleTexts;
  }

  public async getAllSteps(): Promise<BaseElement[]> {
    const locators = await this.singleStep.getElementLocator().all();
    return locators.map((locator) => this.createElementFromLocator(locator));
  }

  public async getAllStepTitles(): Promise<BaseElement[]> {
    const locators = await this.singleStepTitle.getElementLocator().all();
    return locators.map((locator) => this.createElementFromLocator(locator));
  }

  public getStepByTitle(title: string, index = 0): BaseElement {
    const locator = this.stepsContainer
      .getElementLocator()
      .locator(ApplicationEditorHeader.singleStepLink)
      .filter({
        // Use :text-is for exact match, safer than :text
        has: this.page.locator(
          `${ApplicationEditorHeader.singleStepTitle}:text-is("${title}")`,
        ),
      })
      .nth(index); // nth is 0-based in Playwright
    return this.createElementFromLocator(locator);
  }

  public async getStepLinkByTitle(title: string): Promise<string | null> {
    const stepElement = this.getStepByTitle(title);
    return stepElement.getElementLocator().getAttribute('href');
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
