import dialTest from '../core/dialFixtures';
import {
  DefaultModelReference,
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  Types,
} from '../testData';
import { Cursors, Styles } from '../ui/domData';

import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { keys } from '@/src/ui/keyboard';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
let nonDefaultModel: DialAIEntityModel;
let recentModelIds: string[];

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
  nonDefaultModel = GeneratorUtil.randomArrayElement(
    ModelsUtil.getModels().filter((m) => m.id !== defaultModel.id),
  );
  recentModelIds = ModelsUtil.getRecentModelIds();
});

dialTest(
  'Create new conversation.\n' +
    'Default settings in new chat with cleared site data.\n' +
    'Clip icon in message box does not exist if chat is based on model which does not work with attachments',
  async ({
    dialHomePage,
    conversations,
    conversationSettingsModal,
    temperatureSlider,
    iconApiHelper,
    sendMessage,
    agentSettingAssertion,
    chat,
    talkToAgentDialog,
    talkToAgentDialogAssertion,
    talkToAgents,
    baseAssertion,
    localStorageManager,
    fileApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-933', 'EPMRTC-398', 'EPMRTC-1890');
    let modelWithoutAttachments: DialAIEntityModel;

    await dialTest.step(
      'Verify default model is selected by default',
      async () => {
        modelWithoutAttachments = GeneratorUtil.randomArrayElement(
          ModelsUtil.getModelsWithoutAttachment().filter(
            (m) =>
              m.features?.temperature !== undefined &&
              m.features.temperature === true &&
              m.features.systemPrompt !== undefined &&
              m.features.systemPrompt === true,
          ),
        );
        await fileApiHelper.updateInstalledDeployments([
          modelWithoutAttachments,
        ]);
        await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
          modelWithoutAttachments,
        );
        await localStorageManager.useLastConversationSettingsOnce();
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          modelWithoutAttachments.name,
        );
      },
    );

    await dialTest.step(
      'Verify the list of recent entities and icons are displayed and valid',
      async () => {
        const recentTalkTo = await talkToAgents.getEntityNames();
        expect
          .soft(recentTalkTo, ExpectedMessages.recentEntitiesVisible)
          .toEqual([modelWithoutAttachments.name]);

        const recentAgentsIcons = await talkToAgents.getEntityIcons();
        expect
          .soft(recentAgentsIcons, ExpectedMessages.entitiesIconsCountIsValid)
          .toHaveLength(1);

        const expectedEntityIcon = iconApiHelper.getEntityIcon(
          modelWithoutAttachments,
        );
        await baseAssertion.assertEntityIcon(
          recentAgentsIcons[0].iconLocator,
          expectedEntityIcon,
        );
        await talkToAgentDialog.getCloseButton().click();
      },
    );

    await dialTest.step(
      'Verify default settings for default model',
      async () => {
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertSystemPromptValue(
          ExpectedConstants.emptyString,
        );

        const defaultTemperature = await temperatureSlider.getTemperature();
        expect
          .soft(defaultTemperature, ExpectedMessages.defaultTemperatureIsOne)
          .toBe(ExpectedConstants.defaultTemperature);
      },
    );

    await dialTest.step(
      'Create new conversation and verify it is moved under Today section in chat bar, no clip icon is available in message textarea',
      async () => {
        await conversationSettingsModal.cancelButton.click();
        const newConversationName = GeneratorUtil.randomString(7);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(newConversationName);

        const todayConversations = await conversations.getTodayConversations();
        expect
          .soft(todayConversations, ExpectedMessages.newConversationCreated)
          .toHaveLength(1);
        expect
          .soft(todayConversations[0], ExpectedMessages.conversationOfToday)
          .toBe(newConversationName);
        await expect
          .soft(
            sendMessage.attachmentMenuTrigger.getElementLocator(),
            ExpectedMessages.clipIconNotAvailable,
          )
          .toBeHidden();
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
    agentInfo,
    agentInfoAssertion,
    chat,
    sendMessage,
    chatHeader,
    chatMessages,
    page,
    localStorageManager,
    talkToAgentDialog,
    talkToAgents,
    talkToAgentDialogAssertion,
    tooltipPortalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-400', 'EPMRTC-474', 'EPMRTC-817', 'EPMRTC-1568');
    const request = 'test';
    await dialTest.step(
      'Verify Send button is disabled if no request message set and tooltip is shown on button hover',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          nonDefaultModel,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        const isSendMessageBtnEnabled =
          await sendMessage.sendMessageButton.isElementEnabled();
        expect
          .soft(
            isSendMessageBtnEnabled,
            ExpectedMessages.sendMessageButtonDisabled,
          )
          .toBeFalsy();

        await sendMessage.sendMessageButton.hoverOver();
        await tooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.sendMessageTooltip,
        );
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
          await tooltipPortalAssertion.assertTooltipContent(
            ExpectedConstants.sendMessageTooltip,
          );
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
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          nonDefaultModel.name,
        );
        await chat.changeAgentButton.click();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialogAssertion.assertAgentIsSelected(nonDefaultModel);

        const recentTalkTo = await talkToAgents.getEntityNames();
        expect
          .soft(recentTalkTo[0], ExpectedMessages.recentEntitiesIsOnTop)
          .toBe(nonDefaultModel.name);
      },
    );
  },
);

dialTest(
  'Settings on default screen are not saved in local storage when temperature = 0',
  async ({
    dialHomePage,
    agentSettings,
    agentSettingAssertion,
    temperatureSlider,
    setTestIds,
    chat,
    conversationSettingsModal,
    talkToAgentDialog,
    talkToAgentDialogAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-406');
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );
    await localStorageManager.setRecentModelsIdsAndUseLastModel(randomModel);
    await localStorageManager.useLastConversationSettingsOnce();
    await localStorageManager.setShowSideBarPanels();
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chat.configureSettingsButton.click();
    const sysPrompt = 'test prompt';
    const temp = 0;
    const isSysPromptAllowed =
      ModelsUtil.doesModelAllowSystemPrompt(randomModel);
    if (isSysPromptAllowed) {
      await agentSettings.setSystemPrompt(sysPrompt);
    }
    const isTemperatureAllowed =
      ModelsUtil.doesModelAllowTemperature(randomModel);
    if (isTemperatureAllowed) {
      await temperatureSlider.setTemperature(temp);
    }
    await conversationSettingsModal.applyChangesButton.click();

    await dialHomePage.reloadPage();
    await dialHomePage.waitForPageLoaded();
    await chat.configureSettingsButton.click();

    if (isSysPromptAllowed) {
      await agentSettingAssertion.assertSystemPromptValue('');
    }
    if (isTemperatureAllowed) {
      const temperature = await temperatureSlider.getTemperature();
      expect
        .soft(temperature, ExpectedMessages.temperatureIsValid)
        .toBe(ExpectedConstants.defaultTemperature);
    }
    await conversationSettingsModal.cancelButton.click();

    await chat.changeAgentButton.click();
    await talkToAgentDialog.waitForState();
    await talkToAgentDialogAssertion.assertAgentIsSelected(randomModel);
  },
);

dialTest(
  'Recent "Talk to" list is updated',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    modelApiHelper,
    dialHomePage,
    chatBar,
    chat,
    talkToAgentDialog,
    talkToAgents,
    agentInfoAssertion,
    agentInfo,
    talkToAgentDialogAssertion,
    baseAssertion,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1044');
    const appName = GeneratorUtil.randomApplicationName();
    let configApp: DialAIEntityModel;

    await dialTest.step('Create a custom app', async () => {
      const customAppModel = customApplicationBuilder
        .withDisplayName(appName)
        .build();
      await applicationApiHelper.createApplication(customAppModel);
      const configModels = await modelApiHelper.getModels();
      configApp = configModels.find((m) => m.name === appName)!;
      await localStorageManager.setShowSideBarPanels();
      await localStorageManager.setDefaultModelReference(
        DefaultModelReference.lastUsedModel,
      );
    });

    await dialTest.step(
      'Create a new conversation based on custom app and send the request',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(configApp, {
          isHttpMethodTriggered: false,
        });
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('test message');
      },
    );

    await dialTest.step(
      'Create new conversation, change the agent and verify custom app stays at the first place',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          appName,
        );
        await chat.changeAgentButton.click();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialogAssertion.assertAgentIsSelected(configApp);

        const recentTalkTo = await talkToAgents.getEntityNames();
        baseAssertion.assertValue(recentTalkTo[0], appName);
        baseAssertion.assertValue(
          recentTalkTo[1],
          ModelsUtil.getOpenAIEntity(recentModelIds[0])!.name,
        );
      },
    );
  },
);

//TODO: need to update the test-case
dialTest.skip(
  'Search "Talk to" item in "See full list..."',
  async ({
    dialHomePage,
    marketplaceContainer,
    marketplaceFilter,
    marketplaceEntities,
    marketplaceHeader,
    talkToAgentDialog,
    chat,
    modelApiHelper,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-408');
    const randomEntity = GeneratorUtil.randomArrayElement(
      ModelsUtil.getOpenAIEntities().filter((m) => m.name.length >= 3),
    );
    const searchTerm = randomEntity.name.substring(0, 3);
    let expectedMatchedModelsCount: number;
    let expectedMatchedAppsCount: number;
    let searchInput: BaseElement;

    await dialTest.step(
      'Create new conversation and click "Search on My workspace" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.goToMyWorkspace();
        await marketplaceContainer.goToMarketplaceHome();
      },
    );

    await dialTest.step(
      'Type first search term and verify search result is correct',
      async () => {
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(searchTerm);
        const entitiesCount =
          await marketplaceEntities.entityNames.getElementsCount();

        const configModels = await modelApiHelper.getModels();
        const matchedModels = configModels.filter(
          (m) =>
            m.type === EntityType.Model &&
            (m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              m.version?.toLowerCase().includes(searchTerm.toLowerCase())),
        );
        const matchedApplications = configModels.filter(
          (a) =>
            a.type === EntityType.Application &&
            (a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              a.version?.toLowerCase().includes(searchTerm.toLowerCase())),
        );
        expectedMatchedModelsCount =
          ModelsUtil.groupEntitiesByName(matchedModels).size;
        expectedMatchedAppsCount =
          ModelsUtil.groupEntitiesByName(matchedApplications).size;

        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(expectedMatchedModelsCount + expectedMatchedAppsCount);
      },
    );

    await dialTest.step(
      'Click on entity tabs one by one and verify search results are correct',
      async () => {
        await marketplaceFilter.checkTypeFilterOption(Types.models);
        let entitiesCount =
          await marketplaceEntities.entityNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(expectedMatchedModelsCount);

        await marketplaceFilter.checkTypeFilterOption(Types.assistants);
        entitiesCount =
          await marketplaceEntities.entityNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(expectedMatchedModelsCount);

        await marketplaceFilter.checkTypeFilterOption(Types.applications);
        entitiesCount =
          await marketplaceEntities.entityNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(expectedMatchedModelsCount + expectedMatchedAppsCount);
      },
    );

    await dialTest.step(
      'Clear search input and verify all entities are displayed',
      async () => {
        await searchInput.fillInInput('');
        const entitiesCount =
          await marketplaceEntities.entityNames.getElementsCount();
        expect
          .soft(entitiesCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(
            ModelsUtil.getLatestOpenAIEntities(await modelApiHelper.getModels())
              .length,
          );
      },
    );
  },
);
