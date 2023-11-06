import { ModelsUtil } from '@/e2e/src/utils/modelsUtil';

import { OpenAIEntityModel } from '@/src/types/openai';

import test from '../core/fixtures';
import { ExpectedMessages, Groups, ModelIds } from '../testData';
import { Colors } from '../ui/domData';

import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let expectedApplications: OpenAIEntityModel[];

test.beforeAll(async () => {
  expectedApplications = ModelsUtil.getApplications();
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
}) => {
  setTestIds('EPMRTC-413');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  const randomApp = GeneratorUtil.randomArrayElement(expectedApplications);
  await talkToSelector.selectApplication(randomApp.name);

  const appBorderColors = await recentEntities
    .getRecentEntity(randomApp.name)
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

  const expectedAppDescription =
    ModelsUtil.getApplicationDescription(randomApp);
  const appName = await moreInfo.infoApplication.getElementInnerContent();
  expect.soft(appName, ExpectedMessages.infoAppIsValid).toBe(randomApp.name);

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
  }) => {
    setTestIds('EPMRTC-1062', 'EPMRTC-1063');
    const randomApp = GeneratorUtil.randomArrayElement(expectedApplications);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.seeFullList();

    const expectedAppDescr = ModelsUtil.getApplicationDescription(randomApp);
    const appDialogDescription = await modelsDialog.getEntityOptionDescription(
      Groups.applications,
      randomApp.name,
    );
    expect
      .soft(
        expectedAppDescr.includes(appDialogDescription!),
        ExpectedMessages.entityHasDescription,
      )
      .toBeTruthy();

    if (
      expectedAppDescr &&
      (await modelsDialog
        .expandIcon(Groups.applications, randomApp.name)
        .isVisible())
    ) {
      await modelsDialog.expandEntityDescription(
        Groups.applications,
        randomApp.name,
      );
      const isAppDescrFullWidth =
        await modelsDialog.isEntityDescriptionFullWidth(
          Groups.applications,
          randomApp.name,
        );
      expect
        .soft(
          isAppDescrFullWidth,
          ExpectedMessages.entityDescriptionHasFullWidth,
        )
        .toBeTruthy();
    }

    await modelsDialog.selectGroupEntity(randomApp.name, Groups.applications);
    const appDescription = await recentEntities.getRecentEntityDescription(
      randomApp.name,
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
}) => {
  setTestIds('EPMRTC-1064');
  const application = ModelsUtil.getApplication(ModelIds.GPT_WORLD);
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await talkToSelector.seeFullList();

  await modelsDialog.expandEntityDescription(
    Groups.applications,
    application!.name,
  );

  const expectedAppDescriptionLinkAnchors =
    ModelsUtil.getApplicationDescriptionLinkAnchors(application!);
  const randomLinkText = GeneratorUtil.randomArrayElement(
    expectedAppDescriptionLinkAnchors!,
  );
  const linkColor = await modelsDialog.getEntityDescriptionLinkColor(
    Groups.applications,
    application!.name,
    randomLinkText,
  );
  expect
    .soft(linkColor[0], ExpectedMessages.descriptionLinkIsBlue)
    .toBe(Colors.highlightedEntity);

  const demoPage = await dialHomePage.getNewPage(() =>
    modelsDialog.openEntityDescriptionLink(
      Groups.applications,
      application!.name,
      randomLinkText,
    ),
  );
  const expectedLink = ModelsUtil.getApplicationDescriptionLink(
    application!,
    randomLinkText,
  );
  expect
    .soft(await demoPage!.url(), ExpectedMessages.descriptionLinkOpened)
    .toBe(expectedLink);
});
