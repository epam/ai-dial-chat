import dialTest from '../core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  Types,
} from '../testData';
import { Colors, Cursors, Styles } from '../ui/domData';

import { DialAIEntityModel } from '@/chat/types/models';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
let nonDefaultModel: DialAIEntityModel;
let recentAddonIds: string[];
let recentModelIds: string[];
let allEntities: DialAIEntityModel[];
let modelsWithoutSystemPrompt: string[];

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  nonDefaultModel = GeneratorUtil.randomArrayElement(
    ModelsUtil.getModels().filter((m) => m.id !== defaultModel.id),
  );
  recentAddonIds = ModelsUtil.getRecentAddonIds();
  recentModelIds = ModelsUtil.getRecentModelIds();
  allEntities = ModelsUtil.getOpenAIEntities();
  modelsWithoutSystemPrompt = ModelsUtil.getModelsWithoutSystemPrompt();
});

dialTest(
  'Create new conversation.\n' +
    'Default settings in new chat with cleared site data.\n' +
    '"Talk to" icon is set in recent list on default screen for new chat.\n' +
    'Addon icon is set in recent and selected list on default screen for new chat.\n' +
    'Addon icon is set in recent and selected list on default screen for new chat',
  async ({
    dialHomePage,
    chatBar,
    conversations,
    recentEntities,
    entitySettings,
    temperatureSlider,
    addons,
    iconApiHelper,
    talkToEntities,
    sendMessage,
    entitySettingAssertion,
    recentEntitiesAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-933',
      'EPMRTC-398',
      'EPMRTC-376',
      'EPMRTC-1030',
      'EPMRTC-1890',
    );
    const expectedAddons = ModelsUtil.getAddons();
    await dialTest.step(
      'Create new conversation and verify it is moved under Today section in chat bar, no clip icon is available in message textarea ',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
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
        await expect
          .soft(
            await sendMessage.attachmentMenuTrigger.getElementLocator(),
            ExpectedMessages.clipIconNotAvailable,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Verify default model is selected by default',
      async () => {
        await recentEntities.waitForState();
        const modelBorderColors = await talkToEntities
          .getTalkToEntity(defaultModel)
          .getAllBorderColors();
        Object.values(modelBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
              .toBe(Colors.controlsBackgroundAccent);
          });
        });
      },
    );

    await dialTest.step(
      'Verify the list of recent entities and default settings for default model',
      async () => {
        const expectedDefaultRecentEntities = [];
        for (const entity of recentModelIds) {
          expectedDefaultRecentEntities.push(
            allEntities.find((e) => e.id === entity)!.name,
          );
        }

        const recentTalkTo = await talkToEntities.getTalkToEntityNames();
        expect
          .soft(recentTalkTo, ExpectedMessages.recentEntitiesVisible)
          .toEqual(expectedDefaultRecentEntities);

        const defaultSystemPrompt = await entitySettings.getSystemPrompt();
        expect
          .soft(
            defaultSystemPrompt,
            ExpectedMessages.defaultSystemPromptIsEmpty,
          )
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
        for (const addonId of recentAddonIds) {
          expectedDefaultRecentAddons.push(
            expectedAddons.find((a) => a.id === addonId)?.name || addonId,
          );
        }
        const recentAddons = await addons.getRecentAddons();
        expect
          .soft(recentAddons, ExpectedMessages.recentAddonsVisible)
          .toEqual(expectedDefaultRecentAddons);
      },
    );

    await dialTest.step(
      'Verify recent entities icons are displayed and valid',
      async () => {
        const recentEntitiesIcons = await talkToEntities.getEntitiesIcons();
        expect
          .soft(
            recentEntitiesIcons.length,
            ExpectedMessages.entitiesIconsCountIsValid,
          )
          .toBe(recentModelIds.length);

        for (const recentEntityId of recentModelIds) {
          const entity = ModelsUtil.getOpenAIEntity(recentEntityId)!;
          const actualRecentEntity = recentEntitiesIcons.find(
            (e) => e.entityName === entity.name,
          )!;
          const expectedEntityIcon = iconApiHelper.getEntityIcon(entity);
          await recentEntitiesAssertion.assertEntityIcon(
            actualRecentEntity.iconLocator,
            expectedEntityIcon,
          );
        }
      },
    );

    await dialTest.step(
      'Verify recent addon icons are displayed and valid',
      async () => {
        const recentAddonsIcons = await addons.getRecentAddonsIcons();
        expect
          .soft(
            recentAddonsIcons.length,
            ExpectedMessages.addonsIconsCountIsValid,
          )
          .toBe(recentAddonIds.length);

        for (const addon of recentAddonIds) {
          const addonEntity = ModelsUtil.getAddon(addon)!;
          const actualRecentAddon = recentAddonsIcons.find((a) =>
            a.entityName.includes(addonEntity.name),
          )!;
          const expectedAddonIcon = iconApiHelper.getEntityIcon(addonEntity);
          await entitySettingAssertion.assertEntityIcon(
            actualRecentAddon.iconLocator,
            expectedAddonIcon,
          );
        }
      },
    );
  },
);

dialTest(
  'Default model in new chat is set as in previous chat.\n' +
    'Send button is disabled if the message box is empty.\n' +
    'Chat name is shown in chat header.\n' +
    `It's impossible to send a message with spaces only`,
  async ({
    dialHomePage,
    chatBar,
    talkToSelector,
    chat,
    sendMessage,
    chatHeader,
    tooltip,
    chatMessages,
    page,
    talkToEntities,
    localStorageManager,
    marketplacePage,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-400', 'EPMRTC-474', 'EPMRTC-817', 'EPMRTC-1568');
    const request = 'test';
    await dialTest.step(
      'Verify Send button is disabled if no request message set and tooltip is shown on button hover',
      async () => {
        await localStorageManager.setRecentModelsIds(nonDefaultModel);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectEntity(nonDefaultModel, marketplacePage);

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
      },
    );

    await dialTest.step(
      'Set spaces in the message input and Send button is disabled, tooltip is shown on hover, no message send on hit Enter',
      async () => {
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
            .soft(
              sendBtnCursor[0],
              ExpectedMessages.sendButtonCursorIsNotAllowed,
            )
            .toBe(Cursors.notAllowed);

          const tooltipContent = await tooltip.getContent();
          expect
            .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
            .toBe(ExpectedConstants.sendMessageTooltip);
        }
      },
    );

    await dialTest.step(
      'Send new request and verify it is reflected in chat header',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(request);
        const chatTitle = await chatHeader.chatTitle.getElementInnerContent();
        expect
          .soft(chatTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(request);
      },
    );

    await dialTest.step(
      'Create new conversation and verify previous model is preselected and highlighted',
      async () => {
        await chatBar.createNewConversation();
        const modelBorderColors = await talkToEntities
          .getTalkToEntity(nonDefaultModel)
          .getAllBorderColors();
        Object.values(modelBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
              .toBe(Colors.controlsBackgroundAccent);
          });
        });

        const recentTalkTo = await talkToEntities.getTalkToEntityNames();
        expect
          .soft(recentTalkTo[0], ExpectedMessages.recentEntitiesIsOnTop)
          .toBe(nonDefaultModel.name);
      },
    );
  },
);

dialTest(
  'Settings on default screen are saved in local storage when temperature = 0',
  async ({
    dialHomePage,
    recentEntities,
    entitySettings,
    temperatureSlider,
    setTestIds,
    talkToSelector,
    marketplacePage,
    talkToEntities,
    addons,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-406');
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );
    await localStorageManager.setRecentModelsIds(randomModel);
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectEntity(randomModel, marketplacePage);
    const sysPrompt = 'test prompt';
    const temp = 0;
    const isSysPromptAllowed = !modelsWithoutSystemPrompt.includes(
      randomModel.id,
    );
    if (isSysPromptAllowed) {
      await entitySettings.setSystemPrompt(sysPrompt);
    }
    await temperatureSlider.setTemperature(temp);
    await dialHomePage.reloadPage();
    await dialHomePage.waitForPageLoaded();

    await recentEntities.waitForState();
    const modelBorderColors = await talkToEntities
      .getTalkToEntity(randomModel)
      .getAllBorderColors();
    Object.values(modelBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
          .toBe(Colors.controlsBackgroundAccent);
      });
    });

    if (isSysPromptAllowed) {
      const systemPrompt =
        await entitySettings.systemPrompt.getElementContent();
      expect
        .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
        .toBe(sysPrompt);
    }

    const temperature = await temperatureSlider.getTemperature();
    expect
      .soft(temperature, ExpectedMessages.temperatureIsValid)
      .toBe(temp.toString());

    const selectedAddons = await addons.getSelectedAddons();
    expect.soft(selectedAddons, ExpectedMessages.noAddonsSelected).toEqual([]);
  },
);

dialTest(
  'Recent "Talk to" list is updated',
  async ({
    dialHomePage,
    chatBar,
    chat,
    talkToSelector,
    marketplacePage,
    talkToEntities,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1044');
    await dialHomePage.openHomePage({
      iconsToBeLoaded: [defaultModel.iconUrl],
    });
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectEntity(nonDefaultModel, marketplacePage);
    await dialHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
    );
    await chat.sendRequestWithButton('test message');
    await chatBar.createNewConversation();
    const modelBorderColors = await talkToEntities
      .getTalkToEntity(nonDefaultModel)
      .getAllBorderColors();
    Object.values(modelBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
          .toBe(Colors.controlsBackgroundAccent);
      });
    });

    const recentTalkTo = await talkToEntities.getTalkToEntityNames();
    expect
      .soft(recentTalkTo[0], ExpectedMessages.talkToEntityIsSelected)
      .toBe(nonDefaultModel.name);
  },
);

dialTest(
  'Search "Talk to" item in "See full list..."',
  async ({
    dialHomePage,
    talkToSelector,
    marketplaceSidebar,
    marketplaceFilter,
    marketplaceApplications,
    marketplaceHeader,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-408');
    const randomEntity = GeneratorUtil.randomArrayElement(
      ModelsUtil.getOpenAIEntities().filter((m) => m.name.length >= 3),
    );
    const searchTerm = randomEntity.name.substring(0, 3);
    const matchedModels = ModelsUtil.getModels().filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.version?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const matchedApplications = ModelsUtil.getApplications().filter(
      (a) =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.version?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const matchedAssistants = ModelsUtil.getAssistants().filter(
      (a) =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.version?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const expectedMatchedModelsCount =
      ModelsUtil.groupEntitiesByName(matchedModels).size;
    const expectedMatchedAppsCount =
      ModelsUtil.groupEntitiesByName(matchedApplications).size;
    const expectedMatchedAssistantsCount =
      ModelsUtil.groupEntitiesByName(matchedAssistants).size;

    await dialTest.step(
      'Create new conversation and click "Search on My workspace" link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.searchOnMyAppButton();
        await marketplaceSidebar.homePageButton.click();
      },
    );

    await dialTest.step(
      'Type first search term and verify search result is correct',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(searchTerm);
        const entitiesCount =
          await marketplaceApplications.applicationNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(
            expectedMatchedModelsCount +
              expectedMatchedAppsCount +
              expectedMatchedAssistantsCount,
          );
      },
    );

    await dialTest.step(
      'Click on entity tabs one by one and verify search results are correct',
      async () => {
        await marketplaceFilter.checkTypeFilterOption(Types.models);
        let entitiesCount =
          await marketplaceApplications.applicationNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(expectedMatchedModelsCount);

        await marketplaceFilter.checkTypeFilterOption(Types.assistants);
        entitiesCount =
          await marketplaceApplications.applicationNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(expectedMatchedModelsCount + expectedMatchedAssistantsCount);

        await marketplaceFilter.checkTypeFilterOption(Types.applications);
        entitiesCount =
          await marketplaceApplications.applicationNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(
            expectedMatchedModelsCount +
              expectedMatchedAssistantsCount +
              expectedMatchedAppsCount,
          );
      },
    );

    await dialTest.step(
      'Clear search input and verify all entities are displayed',
      async () => {
        await marketplaceHeader.searchInput.fillInInput('');
        const entitiesCount =
          await marketplaceApplications.applicationNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(ModelsUtil.getLatestOpenAIEntities().length);
      },
    );
  },
);
