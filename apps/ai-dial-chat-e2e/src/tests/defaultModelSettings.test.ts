import test from '../core/fixtures';
import { ExpectedConstants, ExpectedMessages, ModelIds } from '../testData';
import { Colors, Cursors, Styles } from '../ui/domData';

import { OpenAIEntityModel } from '@/ai-dial-chat/types/openai';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
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
    apiHelper,
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
          .toEqual(
            expect.stringContaining(ExpectedConstants.newConversationTitle),
          );
      }
    });

    await test.step('Verify default model is selected by default', async () => {
      await recentEntities.waitForState();
      const modelBorderColors = await recentEntities
        .getRecentEntity(defaultModel.name)
        .getAllBorderColors();
      Object.values(modelBorderColors).forEach((borders) => {
        borders.forEach((borderColor) => {
          expect
            .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
            .toBe(Colors.controlsBackgroundAccent);
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
      const recentEntitiesIcons = await recentEntities.getRecentEntitiesIcons();
      expect
        .soft(
          recentEntitiesIcons.length,
          ExpectedMessages.entitiesIconsCountIsValid,
        )
        .toBe(recentModelIds.length);

      for (const model of recentModelIds) {
        const modelEntity = ModelsUtil.getModel(model)!;
        const actualRecentModel = recentEntitiesIcons.find(
          (e) => e.entityName === modelEntity.name,
        )!;
        const expectedEntityIcon = await apiHelper.getEntityIcon(modelEntity);
        expect
          .soft(
            actualRecentModel.icon,
            `${ExpectedMessages.entityIconIsValid} for ${modelEntity.name}`,
          )
          .toBe(expectedEntityIcon);
      }
    });

    await test.step('Verify recent addon icons are displayed and valid', async () => {
      const recentAddonsIcons = await addons.getRecentAddonsIcons();
      expect
        .soft(
          recentAddonsIcons.length,
          ExpectedMessages.addonsIconsCountIsValid,
        )
        .toBe(recentAddonIds.length);

      for (const addon of recentAddonIds) {
        const addonEntity = ModelsUtil.getAddon(addon)!;
        const actualRecentAddon = recentAddonsIcons.find(
          (a) => a.entityName === addonEntity.name,
        )!;
        const expectedAddonIcon = await apiHelper.getEntityIcon(addonEntity);
        expect
          .soft(
            actualRecentAddon.icon,
            `${ExpectedMessages.addonIconIsValid} for ${addonEntity.name}`,
          )
          .toBe(expectedAddonIcon);
      }
    });
  },
);

test(
  'Default model in new chat is set as in previous chat.\n' +
    'Send button is disabled if the message box is empty.\n' +
    'Chat name is shown in chat header.\n' +
    `It's impossible to send a message with spaces only`,
  async ({
    dialHomePage,
    chatBar,
    recentEntities,
    talkToSelector,
    chat,
    sendMessage,
    chatHeader,
    tooltip,
    chatMessages,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-400', 'EPMRTC-474', 'EPMRTC-817', 'EPMRTC-1568');
    const request = 'test';
    await test.step('Verify Send button is disabled if no request message set and tooltip is shown on button hover', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await talkToSelector.selectModel(bison.name);

      const isSendMessageBtnEnabled =
        await sendMessage.sendMessageButton.isElementEnabled();
      expect
        .soft(
          isSendMessageBtnEnabled,
          ExpectedMessages.sendMessageButtonDisabled,
        )
        .toBeFalsy();

      await sendMessage.sendMessageButton.hoverOver();
      const tooltipContent = await tooltip.getContent();
      expect
        .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
        .toBe(ExpectedConstants.sendMessageTooltip);
    });

    await test.step('Set spaces in the message input and Send button is disabled, tooltip is shown on hover, no message send on hit Enter', async () => {
      for (let i = 1; i <= 2; i++) {
        if (i === 2) {
          const messagesCountBefore =
            await chatMessages.chatMessages.getElementsCount();
          await sendMessage.messageInput.fillInInput('   ');
          await page.keyboard.press(keys.enter);
          const messagesCountAfter =
            await chatMessages.chatMessages.getElementsCount();
          expect
            .soft(
              messagesCountBefore === messagesCountAfter,
              ExpectedMessages.messageCountIsCorrect,
            )
            .toBeTruthy();
        }
        const isSendMessageBtnEnabled =
          await sendMessage.sendMessageButton.isElementEnabled();
        expect
          .soft(
            isSendMessageBtnEnabled,
            ExpectedMessages.sendMessageButtonDisabled,
          )
          .toBeFalsy();

        await sendMessage.sendMessageButton.hoverOver();
        const sendBtnCursor =
          await sendMessage.sendMessageButton.getComputedStyleProperty(
            Styles.cursor,
          );
        expect
          .soft(sendBtnCursor[0], ExpectedMessages.sendButtonCursorIsNotAllowed)
          .toBe(Cursors.notAllowed);

        const tooltipContent = await tooltip.getContent();
        expect
          .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.sendMessageTooltip);
      }
    });

    await test.step('Send new request and verify it is reflected in chat header', async () => {
      await chat.sendRequestWithButton(request);
      const chatTitle = await chatHeader.chatTitle.getElementInnerContent();
      expect
        .soft(chatTitle, ExpectedMessages.headerTitleCorrespondRequest)
        .toBe(request);
    });

    await test.step('Create new conversation and verify previous model is preselected and highlighted', async () => {
      await chatBar.createNewConversation();
      const modelBorderColors = await recentEntities
        .getRecentEntity(bison.name)
        .getAllBorderColors();
      Object.values(modelBorderColors).forEach((borders) => {
        borders.forEach((borderColor) => {
          expect
            .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
            .toBe(Colors.controlsBackgroundAccent);
        });
      });

      const recentTalkTo = await recentEntities.getRecentEntityNames();
      expect
        .soft(recentTalkTo[0], ExpectedMessages.recentEntitiesIsOnTop)
        .toBe(bison.name);
    });
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

  await recentEntities.waitForState();
  const modelBorderColors = await recentEntities
    .getRecentEntity(randomModel.name)
    .getAllBorderColors();
  Object.values(modelBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
        .toBe(Colors.controlsBackgroundAccent);
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
        .toBe(Colors.controlsBackgroundAccent);
    });
  });

  const recentTalkTo = await recentEntities.getRecentEntityNames();
  expect
    .soft(recentTalkTo[0], ExpectedMessages.talkToEntityIsSelected)
    .toBe(bison.name);
});

test('Search "Talk to" item in "See full list..."', async ({
  dialHomePage,
  chatBar,
  talkToSelector,
  modelsDialog,
  setTestIds,
}) => {
  setTestIds('EPMRTC-408');
  const randomEntity = GeneratorUtil.randomArrayElement(
    ModelsUtil.getOpenAIEntities().filter((m) => m.name.length >= 3),
  );
  const searchTerm = randomEntity.name.substring(0, 3);
  const matchedModels = ModelsUtil.getModels().filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const matchedApplications = ModelsUtil.getApplications().filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const matchedAssistants = ModelsUtil.getAssistants().filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  await test.step('Create new conversation and click "See full list.." link', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await chatBar.createNewConversation();
    await talkToSelector.seeFullList();
  });

  await test.step('Type first search term and verify search result is correct', async () => {
    await modelsDialog.searchInput.fillInInput(searchTerm);
    const resultsCount = await modelsDialog.groupEntity.getElementsCount();
    expect
      .soft(resultsCount, ExpectedMessages.searchResultCountIsValid)
      .toBe(
        matchedModels.length +
          matchedApplications.length +
          matchedAssistants.length,
      );
  });

  await test.step('Click on entity tabs one by one and verify search results are correct', async () => {
    await modelsDialog.modelsTab.click();
    const assistantsPlusAppResultsCount =
      await modelsDialog.groupEntity.getElementsCount();
    expect
      .soft(
        assistantsPlusAppResultsCount,
        ExpectedMessages.searchResultCountIsValid,
      )
      .toBe(matchedApplications.length + matchedAssistants.length);

    await modelsDialog.assistantsTab.click();
    const appResultsCount = await modelsDialog.groupEntity.getElementsCount();
    expect
      .soft(appResultsCount, ExpectedMessages.searchResultCountIsValid)
      .toBe(matchedApplications.length);

    await modelsDialog.applicationsTab.click();
    const noResult =
      await modelsDialog.noResultFoundIcon.getElementInnerContent();
    expect
      .soft(noResult, ExpectedMessages.noResultsFound)
      .toBe(ExpectedConstants.noResults);
  });

  await test.step('Clear search input and verify all entities are displayed', async () => {
    await modelsDialog.searchInput.fillInInput('');
    await modelsDialog.modelsTab.click();
    await modelsDialog.assistantsTab.click();
    await modelsDialog.applicationsTab.click();
    const resultsCount = await modelsDialog.groupEntity.getElementsCount();
    expect
      .soft(resultsCount, ExpectedMessages.searchResultCountIsValid)
      .toBe(ModelsUtil.getOpenAIEntities().length);
  });
});
