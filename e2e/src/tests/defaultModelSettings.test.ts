import { OpenAIEntityModel } from '@/src/types/openai';

import test from '../core/fixtures';
import { ExpectedConstants, ExpectedMessages, ModelIds } from '../testData';
import { Colors } from '../ui/domData';

import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let defaultModel: OpenAIEntityModel;
let bison: OpenAIEntityModel;
let recentAddonIds: string[];
let recentModelIds: string[];
let allEntities: OpenAIEntityModel[];

test.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  bison = ModelsUtil.getModel(ModelIds.BISON_001)!;
  recentAddonIds = ModelsUtil.getRecentAddonIds();
  recentModelIds = ModelsUtil.getRecentModelIds();
  allEntities = ModelsUtil.getOpenAIEntities();
});

test(
  'Create new conversation.\n' +
    'Default settings in new chat with cleared site data.\n' +
    '"Talk to" icon is set in recent list on default screen for new chat.\n' +
    'Addon icon is set in recent and selected list on default screen for new chat',
  async ({
    dialHomePage,
    chatBar,
    conversations,
    recentEntities,
    entitySettings,
    temperatureSlider,
    addons,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-933', 'EPMRTC-398', 'EPMRTC-376', 'EPMRTC-1030');
    const expectedAddons = ModelsUtil.getAddons();
    await test.step('Create new conversation and verify it is moved under Today section in chat bar', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await chatBar.createNewConversation();

      const todayConversations = await conversations.getTodayConversations();
      expect
        .soft(
          todayConversations.length,
          ExpectedMessages.newConversationCreated,
        )
        .toBe(2);
      for (const todayConversation of todayConversations) {
        expect
          .soft(todayConversation, ExpectedMessages.conversationOfToday)
          .toBe(ExpectedConstants.newConversationTitle);
      }
    });

    await test.step('Verify default model is selected by default', async () => {
      const modelBorderColors = await recentEntities
        .getRecentEntity(defaultModel.name)
        .getAllBorderColors();
      Object.values(modelBorderColors).forEach((borders) => {
        borders.forEach((borderColor) => {
          expect
            .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
            .toBe(Colors.highlightedEntity);
        });
      });
    });

    await test.step('Verify the list of recent entities and default settings for default model', async () => {
      const expectedDefaultRecentEntities = [];
      for (const entity of recentModelIds) {
        expectedDefaultRecentEntities.push(
          allEntities.find((e) => e.id === entity)!.name,
        );
      }

      const recentTalkTo = await recentEntities.getRecentEntityNames();
      expect
        .soft(recentTalkTo, ExpectedMessages.recentEntitiesVisible)
        .toEqual(expectedDefaultRecentEntities);

      const defaultSystemPrompt = await entitySettings.getSystemPrompt();
      expect
        .soft(defaultSystemPrompt, ExpectedMessages.defaultSystemPromptIsEmpty)
        .toBe(ExpectedConstants.emptyString);

      const defaultTemperature = await temperatureSlider.getTemperature();
      expect
        .soft(defaultTemperature, ExpectedMessages.defaultTemperatureIsOne)
        .toBe(ExpectedConstants.defaultTemperature);

      const selectedAddons = await addons.getSelectedAddons();
      expect
        .soft(selectedAddons, ExpectedMessages.noAddonsSelected)
        .toEqual(defaultModel.selectedAddons ?? []);

      const expectedDefaultRecentAddons = [];
      for (const addon of recentAddonIds) {
        expectedDefaultRecentAddons.push(
          expectedAddons.find((a) => a.id === addon)!.name,
        );
      }
      const recentAddons = await addons.getRecentAddons();
      expect
        .soft(recentAddons, ExpectedMessages.recentAddonsVisible)
        .toEqual(expectedDefaultRecentAddons);
    });

    await test.step('Verify recent entities icons are displayed and valid', async () => {
      const recentEntitiesIcons =
        await recentEntities.getRecentEntitiesIconAttributes();
      expect
        .soft(
          recentEntitiesIcons.length,
          ExpectedMessages.entitiesIconsCountIsValid,
        )
        .toBe(recentModelIds.length);

      for (let i = 0; i < recentModelIds.length; i++) {
        const expectedModel = allEntities.find(
          (e) => e.id === recentModelIds[i],
        )!;
        expect
          .soft(
            recentEntitiesIcons[i].iconEntity,
            ExpectedMessages.entityIconIsValid,
          )
          .toBe(expectedModel.id);
        expect
          .soft(
            recentEntitiesIcons[i].iconUrl,
            ExpectedMessages.entityIconSourceIsValid,
          )
          .toBe(expectedModel.iconUrl);
      }
    });

    await test.step('Verify recent addon icons are displayed and valid', async () => {
      const recentAddonsIcons = await addons.getRecentAddonsIconAttributes();
      expect
        .soft(
          recentAddonsIcons.length,
          ExpectedMessages.addonsIconsCountIsValid,
        )
        .toBe(recentAddonIds.length);

      for (let i = 0; i < recentAddonIds.length; i++) {
        const expectedAddon = expectedAddons.find(
          (a) => a.id === recentAddonIds[i],
        )!;
        expect
          .soft(
            recentAddonsIcons[i].iconEntity,
            ExpectedMessages.addonIconIsValid,
          )
          .toBe(expectedAddon.id);
        expect
          .soft(
            recentAddonsIcons[i].iconUrl,
            ExpectedMessages.addonIconSourceIsValid,
          )
          .toBe(expectedAddon.iconUrl);
      }
    });
  },
);

test(
  'Default model in new chat is set as in previous chat.\n' +
    'Error message is shown if to send an empty message.\n' +
    'Chat name is shown in chat header',
  async ({
    dialHomePage,
    chatBar,
    recentEntities,
    talkToSelector,
    chat,
    sendMessage,
    chatHeader,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-400', 'EPMRTC-474', 'EPMRTC-817');
    const request = 'test';
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectModel(bison.name);
    await dialHomePage.acceptBrowserDialog(ExpectedConstants.enterMessageAlert);
    await sendMessage.send('');

    await chat.sendRequestWithButton(request);
    const chatTitle = await chatHeader.chatTitle.getElementInnerContent();
    expect
      .soft(chatTitle, ExpectedMessages.headerTitleCorrespondRequest)
      .toBe(request);

    await chatBar.createNewConversation();
    const modelBorderColors = await recentEntities
      .getRecentEntity(bison.name)
      .getAllBorderColors();
    Object.values(modelBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
          .toBe(Colors.highlightedEntity);
      });
    });

    const recentTalkTo = await recentEntities.getRecentEntityNames();
    expect
      .soft(recentTalkTo[0], ExpectedMessages.recentEntitiesIsOnTop)
      .toBe(bison.name);
  },
);

test('Settings on default screen are saved in local storage when temperature = 0', async ({
  dialHomePage,
  recentEntities,
  entitySettings,
  temperatureSlider,
  setTestIds,
  talkToSelector,
  addons,
}) => {
  setTestIds('EPMRTC-406');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  const randomModel = GeneratorUtil.randomArrayElement(ModelsUtil.getModels());
  await talkToSelector.selectModel(randomModel.name);
  const sysPrompt = 'test prompt';
  const temp = 0;
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await dialHomePage.reloadPage();
  await dialHomePage.waitForPageLoaded();

  const modelBorderColors = await recentEntities
    .getRecentEntity(randomModel.name)
    .getAllBorderColors();
  Object.values(modelBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
        .toBe(Colors.highlightedEntity);
    });
  });

  const systemPrompt = await entitySettings.systemPrompt.getElementContent();
  expect
    .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const selectedAddons = await addons.getSelectedAddons();
  expect.soft(selectedAddons, ExpectedMessages.noAddonsSelected).toEqual([]);
});

test('Recent "Talk to" list is updated', async ({
  dialHomePage,
  chatBar,
  recentEntities,
  chat,
  talkToSelector,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1044');
  await dialHomePage.openHomePage({ iconsToBeLoaded: [defaultModel.iconUrl] });
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await talkToSelector.selectModel(bison.name);
  await chat.sendRequestWithButton('test message');
  await chatBar.createNewConversation();
  const modelBorderColors = await recentEntities
    .getRecentEntity(bison.name)
    .getAllBorderColors();
  Object.values(modelBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
        .toBe(Colors.highlightedEntity);
    });
  });

  const recentTalkTo = await recentEntities.getRecentEntityNames();
  expect
    .soft(recentTalkTo[0], ExpectedMessages.talkToEntityIsSelected)
    .toBe(bison.name);
});
