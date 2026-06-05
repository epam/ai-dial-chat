import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { BackendEntity } from '@/chat/types/common';
import config from '@/config/chat.playwright.config';
import { API } from '@/src/testData';
import {
  EntityEditorHeaderSelectors,
  HeaderSelectors,
  IconSelectors,
} from '@/src/ui/selectors';
import { BaseElement, Button } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export enum EntityEditSteps {
  generalInfo = 'General info',
  appSettings = 'App settings',
  toolsetSettings = 'Toolset settings',
}

export class EntityEditorHeader extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, EntityEditorHeaderSelectors.header, parentLocator);
  }

  public saveAndExitButton = new Button(
    this.page,
    EntityEditorHeaderSelectors.saveAndExitButton,
    this.rootLocator,
  );
  public exitButton = new Button(
    this.page,
    EntityEditorHeaderSelectors.exitButton,
    this.rootLocator,
  );
  public actionAndEntityTypeTitle = this.getChildElementBySelector(
    EntityEditorHeaderSelectors.actionAndEntityTypeTitle,
  );
  public stepsContainer = this.getChildElementBySelector(
    EntityEditorHeaderSelectors.stepsContainer,
  );
  public singleStep = this.getChildElementBySelector(
    EntityEditorHeaderSelectors.singleStepLink,
  );
  public singleStepTitle = this.getChildElementBySelector(
    EntityEditorHeaderSelectors.singleStepTitle,
  );
  public logo = this.getChildElementBySelector(HeaderSelectors.logo);

  public selectedIcon(step: BaseElement) {
    return step.getChildElementBySelector(
      EntityEditorHeaderSelectors.selectedStepIcon,
    );
  }

  public selectedFilledPointIcon(step: BaseElement) {
    return step.getChildElementBySelector(
      `${EntityEditorHeaderSelectors.selectedStepIcon}${IconSelectors.filledPointIcon}`,
    );
  }

  public notSelectedIcon(step: BaseElement) {
    return step.getChildElementBySelector(
      EntityEditorHeaderSelectors.notSelectedStepIcon,
    );
  }

  public notSelectedCheckedCircleIcon(step: BaseElement) {
    return step.getChildElementBySelector(
      `${EntityEditorHeaderSelectors.notSelectedStepIcon}${IconSelectors.checkIcon}`,
    );
  }

  public notSelectedPointIcon(step: BaseElement) {
    return step.getChildElementBySelector(
      `${EntityEditorHeaderSelectors.notSelectedStepIcon}${IconSelectors.filledPointIcon}`,
    );
  }

  public getStepByTitle(title: string, index?: number): BaseElement {
    const locator = this.stepsContainer
      .getChildElementBySelector(EntityEditorHeaderSelectors.singleStepLink)
      .getElementLocatorByText(
        new RegExp(`^${RegexUtil.escapeRegexChars(title)}$`),
        index,
      );
    return this.createElementFromLocator(locator);
  }

  public getGeneralInfoStep(): BaseElement {
    return this.getStepByTitle(EntityEditSteps.generalInfo);
  }

  public getAppSettingsStep(): BaseElement {
    return this.getStepByTitle(EntityEditSteps.appSettings);
  }

  public getToolsetSettingsStep(): BaseElement {
    return this.getStepByTitle(EntityEditSteps.toolsetSettings);
  }

  public async goOnGeneralInfoStepWithHeaderStepper(
    options: { isHttpMethodTriggered: boolean } = {
      isHttpMethodTriggered: true,
    },
  ) {
    if (options.isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(API.applicationCreateHost) &&
          resp.request().method() === 'PUT',
      );
      await this.getGeneralInfoStep().click();
      await respPromise;
    } else {
      await this.getGeneralInfoStep().click();
    }
  }

  public async focusOn(options?: { triggeredHost: string }) {
    const headerBounding = await this.getElementBoundingBox();
    if (options?.triggeredHost) {
      const respPromise = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(options.triggeredHost) &&
          resp.request().method() === 'PUT',
        { timeout: config.use!.actionTimeout! * 2 },
      );
      await this.page.mouse.move(
        headerBounding!.x + headerBounding!.width / 2,
        headerBounding!.y + headerBounding!.height / 2,
      );
      const resolvedResp = await respPromise;
      const requestBody = resolvedResp.request().postDataJSON();
      const responseBody = await resolvedResp.json();
      return {
        request: requestBody as ApiApplicationModelRegular,
        response: responseBody as BackendEntity,
      };
    } else {
      await this.page.mouse.move(
        headerBounding!.x + headerBounding!.width / 2,
        headerBounding!.y + headerBounding!.height / 2,
      );
    }
  }

  public async goToEntitySettingsStepWithHeaderStepper(
    options: { isHttpMethodTriggered: boolean } = {
      isHttpMethodTriggered: true,
    },
  ) {
    if (options.isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(API.applicationCreateHost) &&
          resp.request().method() === 'PUT',
      );
      await this.getAppSettingsStep().click();
      await respPromise;
    } else {
      await this.getAppSettingsStep().click();
    }
  }
}
