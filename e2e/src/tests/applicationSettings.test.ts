import { OpenAIEntityModelID, OpenAIEntityModels } from '@/src/types/openai';

import test from '../core/fixtures';
import { ExpectedMessages, Groups } from '../testData';
import { Colors } from '../ui/domData';

import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let expectedAppNames: string[];
test.beforeAll(async ({ apiHelper }) => {
  expectedAppNames = await apiHelper.getApplicationNames();
});

test('Check default settings screen for Application', async ({
  dialHomePage,
  addons,
  recentEntities,
  modelSelector,
  entitySettings,
  temperatureSlider,
  moreInfo,
  setTestIds,
  talkToSelector,
  apiHelper,
}) => {
  setTestIds('EPMRTC-413');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  const randomApp = GeneratorUtil.randomArrayElement(expectedAppNames);
  await talkToSelector.selectApplication(randomApp);

  const appBorderColors = await recentEntities
    .getRecentEntity(randomApp)
    .getAllBorderColors();
  Object.values(appBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
        .toBe(Colors.highlightedEntity);
    });
  });

  const isTemperatureSliderVisible = await temperatureSlider.isVisible();
  expect
    .soft(
      isTemperatureSliderVisible,
      ExpectedMessages.temperatureSliderNotVisible,
    )
    .toBeFalsy();

  const isSystemPromptVisible = await entitySettings.systemPrompt.isVisible();
  expect
    .soft(isSystemPromptVisible, ExpectedMessages.systemPromptNotVisible)
    .toBeFalsy();

  const isModelSelectorVisible = await modelSelector.isVisible();
  expect
    .soft(isModelSelectorVisible, ExpectedMessages.modelSelectorNotVisible)
    .toBeFalsy();

  const isAddonsVisible = await addons.isVisible();
  expect.soft(isAddonsVisible, ExpectedMessages.addonsNotVisible).toBeFalsy();

  const expectedAppDescription = await apiHelper.getApplicationDescription(
    randomApp,
  );
  const appName = await moreInfo.infoApplication.getElementInnerContent();
  expect.soft(appName, ExpectedMessages.infoAppIsValid).toBe(randomApp);

  const appDescr = await moreInfo.getApplicationDescription();
  expect
    .soft(
      appDescr.replaceAll('\n', ''),
      ExpectedMessages.infoAppDescriptionIsValid,
    )
    .toBe(expectedAppDescription);
});

test(
  'Application has short description on See full list\n' +
    'Application has detailed description on See full list',
  async ({
    dialHomePage,
    recentEntities,
    talkToSelector,
    modelsDialog,
    setTestIds,
    apiHelper,
  }) => {
    setTestIds('EPMRTC-1062', 'EPMRTC-1063');
    const randomApp = GeneratorUtil.randomArrayElement(expectedAppNames);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await talkToSelector.seeFullList();

    const expectedAppDescr = await apiHelper.getApplicationDescription(
      randomApp,
    );
    const appDialogDescription = await modelsDialog
      .entityOptionDescription(Groups.applications, randomApp)
      .innerText();
    expect
      .soft(
        expectedAppDescr.includes(appDialogDescription),
        ExpectedMessages.entityHasDescription,
      )
      .toBeTruthy();

    if (
      expectedAppDescr &&
      (await modelsDialog
        .expandIcon(Groups.applications, randomApp)
        .isVisible())
    ) {
      await modelsDialog.expandEntityDescription(
        Groups.applications,
        randomApp,
      );
      const isAppDescrFullWidth =
        await modelsDialog.isEntityDescriptionFullWidth(
          Groups.applications,
          randomApp,
        );
      expect
        .soft(
          isAppDescrFullWidth,
          ExpectedMessages.entityDescriptionHasFullWidth,
        )
        .toBeTruthy();
    }

    await modelsDialog.selectGroupEntity(randomApp, Groups.applications);
    const appDescription = await recentEntities.getRecentEntityDescription(
      randomApp,
    );
    expect
      .soft(
        expectedAppDescr.includes(appDescription),
        ExpectedMessages.entityHasDescription,
      )
      .toBeTruthy();
  },
);

test('Link from the detailed description opens page in new tab', async ({
  dialHomePage,
  talkToSelector,
  modelsDialog,
  setTestIds,
  apiHelper,
}) => {
  setTestIds('EPMRTC-1064');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await talkToSelector.seeFullList();

  await modelsDialog.expandEntityDescription(
    Groups.applications,
    OpenAIEntityModels[OpenAIEntityModelID.GPT_WORLD].name,
  );

  const application = await apiHelper.getApplication(
    OpenAIEntityModels[OpenAIEntityModelID.GPT_WORLD].name,
  );
  const expectedAppDescriptionLinkAnchors =
    await apiHelper.getApplicationDescriptionLinkAnchors(application!);
  const randomLinkText = GeneratorUtil.randomArrayElement(
    expectedAppDescriptionLinkAnchors!,
  );
  const linkColor = await modelsDialog.getEntityDescriptionLinkColor(
    Groups.applications,
    OpenAIEntityModels[OpenAIEntityModelID.GPT_WORLD].name,
    randomLinkText,
  );
  expect
    .soft(linkColor[0], ExpectedMessages.descriptionLinkIsBlue)
    .toBe(Colors.highlightedEntity);

  const demoPage = await dialHomePage.getNewPage(() =>
    modelsDialog.openEntityDescriptionLink(
      Groups.applications,
      OpenAIEntityModels[OpenAIEntityModelID.GPT_WORLD].name,
      randomLinkText,
    ),
  );
  const expectedLink = await apiHelper.getApplicationDescriptionLink(
    application!,
    randomLinkText,
  );
  expect
    .soft(await demoPage!.url(), ExpectedMessages.descriptionLinkOpened)
    .toBe(expectedLink);
});
